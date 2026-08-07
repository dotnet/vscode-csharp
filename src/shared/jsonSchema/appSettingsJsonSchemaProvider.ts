/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
    JsonObject,
    JsonSchemaSegment,
    JsonSchemaSegmentItem,
    JsonSchemaSegmentItemsResult,
    jsonSchemaDialect,
    matchJsonSchemaFilePattern,
    maximumSegmentCount,
    mergeJsonSchemaSegments,
    parseJsonSchemaSegment,
} from './jsonSchemaSegments';

export const appSettingsJsonSchemaScheme = 'csharp-appsettings-schema';
export const appSettingsJsonSchemaUri = `${appSettingsJsonSchemaScheme}://schemas/appsettings.schema.json`;

export interface Disposable {
    dispose(): void;
}

/** An open JSON document that the `appsettings` schema associations in package.json apply to. */
export interface AppSettingsDocument {
    /** Stable identity of the document, used to detect when the routed set of documents changes. */
    id: string;
    /** File name only, matched against `JsonSchemaSegment` `FilePathPattern` metadata. */
    fileName: string;
    /** Directory containing the document; the search for the owning project starts here. */
    directory: string;
    /** URI scheme of the document. Only `file` documents can be routed to an MSBuild project. */
    scheme: string;
}

export interface AppSettingsJsonSchemaProviderDependencies {
    /** MSBuild evaluation runs a build tool, so it is only performed in a trusted workspace. */
    readonly isTrusted: boolean;
    /** The `appsettings` documents that the JSON language service may currently be validating. */
    getAppSettingsDocuments(): readonly AppSettingsDocument[];
    /** Resolves the project that owns a document, or `undefined` when it is outside any project. */
    findOwningProject(document: AppSettingsDocument): Promise<string | undefined>;
    evaluateProject(projectPath: string, signal: AbortSignal): Promise<JsonSchemaSegmentItemsResult>;
    /** Reads a schema fragment, or returns `undefined` when it is missing or unusable. */
    readSegment(segmentPath: string): Promise<string | undefined>;
    /** Fires when project files change, invalidating evaluated `JsonSchemaSegment` items. */
    watchProjectInputs(listener: () => void): Disposable;
    /** Fires when one of the resolved schema fragments changes on disk. */
    watchSegmentFiles(segmentPaths: readonly string[], listener: () => void): Disposable;
    /** Fires when the set of open `appsettings` documents changes. */
    watchAppSettingsDocuments(listener: () => void): Disposable;
    log(level: 'debug' | 'warn', message: string): void;
}

export interface AppSettingsJsonSchemaProviderOptions {
    debounceMilliseconds?: number;
}

/**
 * Bound on how many distinct diagnostics are remembered for de-duplication. Diagnostics are recorded
 * so that a permanently broken segment does not append to the log on every schema request.
 */
const maximumRememberedDiagnostics = 256;

/**
 * Serves the merged `appsettings.json` schema contributed by `JsonSchemaSegment` MSBuild items.
 *
 * NuGet packages such as the Aspire integrations, YARP and the Azure SDK ship partial JSON schemas
 * and register them with an MSBuild item. Visual Studio consumes those items to offer IntelliSense
 * while editing `appsettings.json`; this provider does the same for VS Code by evaluating the item
 * with `dotnet msbuild -getItem:JsonSchemaSegment` and merging the referenced fragments into a
 * single document served from the `csharp-appsettings-schema` scheme.
 *
 * Routing note: VS Code has no API for associating a schema with a specific document
 * (https://github.com/microsoft/vscode/issues/230136), so the JSON language service asks for the
 * schema URI without saying which document triggered the request. Instead of unioning every project
 * in the workspace, the content is derived from the `appsettings` documents that are actually open:
 * each one is routed to its owning project, and only the segments whose `FilePathPattern` matches
 * that document's file name participate. With a single open document - the overwhelmingly common
 * case - that is exactly per-document routing; with several open at once the result is the union
 * over just those documents, which can offer a completion that belongs to a sibling project but
 * never drops one that belongs to the document being edited.
 */
export class AppSettingsJsonSchemaProvider implements Disposable {
    private readonly debounceMilliseconds: number;
    private readonly listeners = new Set<(uri: string) => unknown>();
    private readonly projectEvaluations = new Map<string, SharedEvaluation<readonly JsonSchemaSegmentItem[]>>();
    private readonly segmentSchemas = new Map<string, JsonObject | undefined>();
    private readonly reportedDiagnostics = new Set<string>();
    private readonly documentWatcher: Disposable;
    private readonly projectWatcher: Disposable;
    private segmentWatcher?: Disposable;
    private watchedSegmentPaths = '';
    private cached?: { routingKey: string; content: string };
    private composition?: { routingKey: string; evaluation: SharedEvaluation<string> };
    private invalidationTimer?: NodeJS.Timeout;
    private disposed = false;

    public constructor(
        private readonly dependencies: AppSettingsJsonSchemaProviderDependencies,
        options: AppSettingsJsonSchemaProviderOptions = {}
    ) {
        this.debounceMilliseconds = options.debounceMilliseconds ?? 250;
        // Registering watchers is the only work done up front. Nothing is evaluated until the JSON
        // language service actually asks for the schema, which only happens once an appsettings
        // document is opened.
        this.projectWatcher = dependencies.watchProjectInputs(() => this.invalidate('projects'));
        this.documentWatcher = dependencies.watchAppSettingsDocuments(() => this.invalidate('documents'));
    }

    public readonly onDidChange = (listener: (uri: string) => unknown): Disposable => {
        this.listeners.add(listener);
        return {
            dispose: () => this.listeners.delete(listener),
        };
    };

    /**
     * Returns the schema document for the currently open `appsettings` documents. This never
     * rejects: a failure or a cancellation yields the neutral schema so that the JSON language
     * service keeps validating with the SchemaStore association contributed alongside this one.
     */
    public async getSchemaContent(signal?: AbortSignal): Promise<string> {
        if (this.disposed || !this.dependencies.isTrusted || signal?.aborted) {
            return neutralSchemaContent;
        }

        const documents = this.dependencies.getAppSettingsDocuments();
        const routingKey = createRoutingKey(documents);
        if (this.cached?.routingKey === routingKey) {
            return this.cached.content;
        }

        // A composition that was abandoned resolves with the neutral schema, so it must not be reused
        // for the next request even though its routing key still matches.
        if (this.composition?.routingKey !== routingKey || this.composition.evaluation.aborted) {
            this.composition?.evaluation.abort();
            this.composition = {
                routingKey,
                evaluation: new SharedEvaluation(async (compositionSignal) =>
                    this.composeSchemaContent(documents, compositionSignal)
                        .catch((error) => {
                            if (!compositionSignal.aborted) {
                                this.report(
                                    'warn',
                                    `Unable to load appsettings JSON schema segments: ${getErrorMessage(error)}`
                                );
                            }

                            return neutralSchemaContent;
                        })
                        .then((content) => {
                            if (!this.disposed && !compositionSignal.aborted) {
                                this.cached = { routingKey, content };
                            }

                            return content;
                        })
                ),
            };
        }

        return await this.composition.evaluation.wait(signal);
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        if (this.invalidationTimer !== undefined) {
            clearTimeout(this.invalidationTimer);
            this.invalidationTimer = undefined;
        }

        this.composition?.evaluation.abort();
        this.composition = undefined;
        for (const evaluation of this.projectEvaluations.values()) {
            evaluation.abort();
        }

        this.projectEvaluations.clear();
        this.projectWatcher.dispose();
        this.documentWatcher.dispose();
        this.segmentWatcher?.dispose();
        this.listeners.clear();
    }

    private async composeSchemaContent(
        documents: readonly AppSettingsDocument[],
        signal: AbortSignal
    ): Promise<string> {
        const documentsByProject = new Map<string, AppSettingsDocument[]>();
        for (const document of documents) {
            if (document.scheme !== 'file') {
                // MSBuild cannot evaluate a project that is not backed by the local file system.
                // This is unreachable for the shipping configuration because the extension declares
                // `virtualWorkspaces: false`, but a single document can still come from another
                // provider inside an otherwise local workspace.
                this.report('debug', `Skipping '${document.id}' because its scheme is not supported.`);
                continue;
            }

            const project = await this.dependencies.findOwningProject(document);
            if (signal.aborted) {
                return neutralSchemaContent;
            }

            if (project === undefined) {
                this.report('debug', `No project owns '${document.id}', so no schema segments apply.`);
                continue;
            }

            const documentsForProject = documentsByProject.get(project);
            if (documentsForProject === undefined) {
                documentsByProject.set(project, [document]);
            } else {
                documentsForProject.push(document);
            }
        }

        const selected = new Map<string, JsonSchemaSegmentItem>();
        for (const project of [...documentsByProject.keys()].sort(compareOrdinal)) {
            if (signal.aborted) {
                return neutralSchemaContent;
            }

            const items = await this.getProjectSegments(project, signal);
            for (const item of items) {
                if (selected.has(item.path)) {
                    continue;
                }

                if (this.appliesToAnyDocument(item, documentsByProject.get(project)!)) {
                    selected.set(item.path, item);
                }
            }
        }

        const segmentPaths = [...selected.keys()].sort(compareOrdinal);
        if (segmentPaths.length > maximumSegmentCount) {
            this.report(
                'warn',
                `Only the first ${maximumSegmentCount} of ${segmentPaths.length} JSON schema segments are used.`
            );
            segmentPaths.length = maximumSegmentCount;
        }

        const segments: JsonSchemaSegment[] = [];
        for (const segmentPath of segmentPaths) {
            if (signal.aborted) {
                return neutralSchemaContent;
            }

            const schema = await this.getSegmentSchema(segmentPath);
            if (schema !== undefined) {
                segments.push({ path: segmentPath, schema });
            }
        }

        if (signal.aborted) {
            return neutralSchemaContent;
        }

        this.updateSegmentWatcher(segmentPaths);
        const merged = mergeJsonSchemaSegments(segments);
        for (const conflict of merged.conflicts) {
            this.report(
                'warn',
                `Conflicting JSON schema value at '${conflict.pointer}' contributed by '${conflict.ignoredSource}' was ignored in favor of the value from '${conflict.keptSource}'.`
            );
        }

        for (const reference of merged.unresolvedReferences) {
            this.report('debug', `JSON schema reference '${reference}' is not defined by any segment and was dropped.`);
        }

        return formatSchemaContent(merged.schema);
    }

    private appliesToAnyDocument(item: JsonSchemaSegmentItem, documents: readonly AppSettingsDocument[]): boolean {
        let applies = false;
        for (const document of documents) {
            const result = matchJsonSchemaFilePattern(item.filePathPattern, document.fileName);
            if (result.diagnostic !== undefined) {
                this.report('warn', `${result.diagnostic} The segment '${item.path}' was ignored.`);
                return false;
            }

            applies ||= result.matches;
        }

        return applies;
    }

    private async getProjectSegments(
        projectPath: string,
        signal: AbortSignal
    ): Promise<readonly JsonSchemaSegmentItem[]> {
        let evaluation = this.projectEvaluations.get(projectPath);
        if (evaluation === undefined) {
            evaluation = new SharedEvaluation(async (evaluationSignal) => {
                try {
                    const result = await this.dependencies.evaluateProject(projectPath, evaluationSignal);
                    for (const diagnostic of result.diagnostics) {
                        this.report('warn', diagnostic);
                    }

                    return result.segments;
                } catch (error) {
                    if (!evaluationSignal.aborted) {
                        this.report(
                            'warn',
                            `Unable to evaluate JsonSchemaSegment items for '${projectPath}': ${getErrorMessage(error)}`
                        );
                    }

                    // A cancelled or failed evaluation must not be remembered as an empty result,
                    // otherwise the segments would stay missing until the project file changes.
                    this.projectEvaluations.delete(projectPath);
                    return [];
                }
            });
            this.projectEvaluations.set(projectPath, evaluation);
        }

        return await evaluation.wait(signal);
    }

    private async getSegmentSchema(segmentPath: string): Promise<JsonObject | undefined> {
        const cachedSchema = this.segmentSchemas.get(segmentPath);
        if (cachedSchema !== undefined || this.segmentSchemas.has(segmentPath)) {
            return cachedSchema;
        }

        let schema: JsonObject | undefined;
        try {
            const content = await this.dependencies.readSegment(segmentPath);
            if (content === undefined) {
                this.report('warn', `JSON schema segment '${segmentPath}' could not be read.`);
            } else {
                const parsed = parseJsonSchemaSegment(segmentPath, content);
                for (const diagnostic of parsed.diagnostics) {
                    this.report('warn', diagnostic);
                }

                schema = parsed.schema;
            }
        } catch (error) {
            this.report('warn', `Unable to read JSON schema segment '${segmentPath}': ${getErrorMessage(error)}`);
        }

        this.segmentSchemas.set(segmentPath, schema);
        return schema;
    }

    private updateSegmentWatcher(segmentPaths: readonly string[]): void {
        const watchedSegmentPaths = segmentPaths.join('\n');
        if (watchedSegmentPaths === this.watchedSegmentPaths) {
            return;
        }

        this.segmentWatcher?.dispose();
        this.segmentWatcher =
            segmentPaths.length > 0
                ? this.dependencies.watchSegmentFiles(segmentPaths, () => this.invalidate('segments'))
                : undefined;
        this.watchedSegmentPaths = watchedSegmentPaths;
    }

    /**
     * Drops the caches affected by a change and notifies listeners once the change settles. Edits
     * to a project file arrive as a burst of watcher events, and each notification makes the JSON
     * language service re-request the schema, so the notification is debounced.
     */
    private invalidate(reason: 'projects' | 'segments' | 'documents'): void {
        if (this.disposed) {
            return;
        }

        if (reason === 'projects') {
            for (const evaluation of this.projectEvaluations.values()) {
                evaluation.abort();
            }

            this.projectEvaluations.clear();
        }

        if (reason === 'projects' || reason === 'segments') {
            this.segmentSchemas.clear();
        }

        if (reason === 'documents' && this.cached?.routingKey === this.currentRoutingKey()) {
            // Opening or closing an unrelated JSON document does not change what the schema should
            // contain, so avoid making every editor with an appsettings file revalidate.
            return;
        }

        this.cached = undefined;
        this.composition?.evaluation.abort();
        this.composition = undefined;

        if (this.invalidationTimer !== undefined) {
            clearTimeout(this.invalidationTimer);
        }

        this.invalidationTimer = setTimeout(() => {
            this.invalidationTimer = undefined;
            for (const listener of this.listeners) {
                listener(appSettingsJsonSchemaUri);
            }
        }, this.debounceMilliseconds);
    }

    private currentRoutingKey(): string {
        return createRoutingKey(this.dependencies.getAppSettingsDocuments());
    }

    private report(level: 'debug' | 'warn', message: string): void {
        if (this.reportedDiagnostics.has(message)) {
            return;
        }

        if (this.reportedDiagnostics.size >= maximumRememberedDiagnostics) {
            this.reportedDiagnostics.clear();
        }

        this.reportedDiagnostics.add(message);
        this.dependencies.log(level, message);
    }
}

/**
 * Shared, reference counted work.
 *
 * Several JSON language service requests can arrive for the same schema at once, and each carries
 * its own cancellation token. The underlying MSBuild evaluation is only cancelled once every
 * requester has gone away, so one editor closing cannot cancel the work another editor is waiting
 * on, while an abandoned evaluation still gets torn down promptly.
 */
class SharedEvaluation<T> {
    private readonly controller = new AbortController();
    private readonly promise: Promise<T>;
    private waiters = 0;

    public constructor(work: (signal: AbortSignal) => Promise<T>) {
        this.promise = work(this.controller.signal);
    }

    /**
     * True once the shared work has been abandoned. An aborted evaluation resolves with a fallback
     * value rather than the real result, so callers must not treat it as a usable cache entry.
     */
    public get aborted(): boolean {
        return this.controller.signal.aborted;
    }

    public async wait(signal?: AbortSignal): Promise<T> {
        this.waiters++;
        let released = false;
        const release = () => {
            if (!released) {
                released = true;
                this.waiters--;
            }
        };
        const onAbort = () => {
            release();
            if (this.waiters === 0) {
                this.controller.abort();
            }
        };

        signal?.addEventListener('abort', onAbort, { once: true });
        try {
            return await this.promise;
        } finally {
            signal?.removeEventListener('abort', onAbort);
            release();
        }
    }

    public abort(): void {
        this.controller.abort();
    }
}

/**
 * The schema served when there is nothing to contribute. `{}` is the schema that accepts any
 * document, so composing it with the SchemaStore `appsettings` association contributed alongside it
 * leaves validation exactly as it was before this feature existed.
 */
const neutralSchemaContent = formatSchemaContent({ $schema: jsonSchemaDialect });

function formatSchemaContent(schema: JsonObject): string {
    return `${JSON.stringify(schema, null, 2)}\n`;
}

/**
 * Identity of the set of documents the schema is built for. Documents in the same directory with
 * the same name route identically, so collapsing them avoids rebuilding the schema when a file is
 * opened in a second editor group.
 */
function createRoutingKey(documents: readonly AppSettingsDocument[]): string {
    return [
        ...new Set(
            documents.map((document) => `${document.scheme}\u0000${document.directory}\u0000${document.fileName}`)
        ),
    ]
        .sort(compareOrdinal)
        .join('\n');
}

function compareOrdinal(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
