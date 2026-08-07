/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
    AppSettingsDocument,
    AppSettingsJsonSchemaProvider,
    appSettingsJsonSchemaScheme,
    appSettingsJsonSchemaUri,
} from './appSettingsJsonSchemaProvider';
import { isAppSettingsFileName, maximumSegmentBytes, parseMsBuildJsonSchemaSegments } from './jsonSchemaSegments';
import { runDotnetMsBuild } from './dotnetMsBuildEvaluator';
import { omnisharpOptions } from '../options';

/** Project file extensions whose presence marks a directory as the owner of nearby JSON files. */
const projectFileExtensions = ['csproj', 'fsproj', 'vbproj'];

/** Directories that never own an appsettings file and can be very large, so they are not searched. */
const ignoredDirectoryNames = new Set(['bin', 'obj', 'node_modules', '.git']);

/** Bound on how far the search for an owning project walks towards the file system root. */
const maximumProjectSearchDepth = 32;

const evaluationTimeoutMilliseconds = 15_000;
const maximumEvaluationOutputBytes = 4 * 1024 * 1024;

/**
 * Registers the text document content provider that backs the `csharp-appsettings-schema` JSON
 * schema association contributed in package.json.
 *
 * This is intentionally cheap: it creates the provider and its watchers and returns. No file system
 * access, project scan or MSBuild evaluation happens until the JSON language service requests the
 * schema, which only occurs once an `appsettings` document is opened.
 */
export function registerAppSettingsJsonSchemaProvider(outputChannel: vscode.LogOutputChannel): vscode.Disposable {
    const schemaUri = vscode.Uri.parse(appSettingsJsonSchemaUri);
    const projectDirectoryCache = new Map<string, Promise<string | undefined>>();
    const provider = new AppSettingsJsonSchemaProvider({
        get isTrusted() {
            return vscode.workspace.isTrusted;
        },
        getAppSettingsDocuments: () =>
            vscode.workspace.textDocuments
                .filter((document) => isAppSettingsFileName(basename(document.uri)))
                .map(toAppSettingsDocument),
        findOwningProject: async (document) => await findOwningProject(document, projectDirectoryCache),
        evaluateProject: async (projectPath, signal) => {
            outputChannel.debug(`Evaluating JsonSchemaSegment items for '${projectPath}'.`);
            const output = await runDotnetMsBuild(projectPath, {
                dotnetExecutablePath: omnisharpOptions.dotnetPath.length > 0 ? omnisharpOptions.dotnetPath : undefined,
                timeoutMilliseconds: evaluationTimeoutMilliseconds,
                maxOutputBytes: maximumEvaluationOutputBytes,
                signal,
            });
            return parseMsBuildJsonSchemaSegments(output, projectPath);
        },
        readSegment: async (segmentPath) => await readSegment(segmentPath, outputChannel),
        watchProjectInputs: (listener) => {
            const invalidateOwnership = () => {
                // A new or removed project file can change which project owns a document, so the
                // resolved ownership has to be discarded along with the evaluated items.
                projectDirectoryCache.clear();
                listener();
            };

            return vscode.Disposable.from(
                createFileWatchers(
                    [
                        `**/*.{${projectFileExtensions.join(',')}}`,
                        '**/Directory.Build.props',
                        '**/Directory.Build.targets',
                        '**/Directory.Packages.props',
                    ],
                    invalidateOwnership
                ),
                // Nothing is evaluated until the workspace is trusted, so granting trust has to
                // re-run the evaluation that was previously refused.
                vscode.workspace.onDidGrantWorkspaceTrust(invalidateOwnership)
            );
        },
        watchSegmentFiles: (segmentPaths, listener) =>
            createFileWatchers(
                segmentPaths.map(
                    (segmentPath) =>
                        new vscode.RelativePattern(vscode.Uri.file(dirname(segmentPath)), basenameOfPath(segmentPath))
                ),
                listener
            ),
        watchAppSettingsDocuments: (listener) => {
            const onDocumentChanged = (document: vscode.TextDocument) => {
                if (isAppSettingsFileName(basename(document.uri))) {
                    listener();
                }
            };

            return vscode.Disposable.from(
                vscode.workspace.onDidOpenTextDocument(onDocumentChanged),
                vscode.workspace.onDidCloseTextDocument(onDocumentChanged),
                vscode.workspace.onDidChangeWorkspaceFolders(() => {
                    projectDirectoryCache.clear();
                    listener();
                })
            );
        },
        log: (level, message) => outputChannel[level](message),
    });

    const changeEmitter = new vscode.EventEmitter<vscode.Uri>();
    const changeSubscription = provider.onDidChange(() => changeEmitter.fire(schemaUri));
    const registration = vscode.workspace.registerTextDocumentContentProvider(appSettingsJsonSchemaScheme, {
        onDidChange: changeEmitter.event,
        provideTextDocumentContent: async (_uri, token) => {
            const cancellation = new AbortController();
            const cancellationSubscription = token.onCancellationRequested(() => cancellation.abort());
            try {
                return await provider.getSchemaContent(cancellation.signal);
            } finally {
                cancellationSubscription.dispose();
            }
        },
    });

    return vscode.Disposable.from(provider, changeEmitter, changeSubscription, registration);
}

function toAppSettingsDocument(document: vscode.TextDocument): AppSettingsDocument {
    return {
        id: document.uri.toString(),
        fileName: basename(document.uri),
        directory: dirnameUri(document.uri).toString(),
        scheme: document.uri.scheme,
    };
}

/**
 * Finds the project that owns an `appsettings` document by walking towards the workspace folder
 * root looking for a project file, which is how the .NET SDK associates content with a project.
 *
 * Directory listings go through `vscode.workspace.fs` rather than `node:fs` so that the lookup works
 * against whichever file system provider backs the document, and each directory is only inspected
 * once per workspace configuration.
 */
async function findOwningProject(
    document: AppSettingsDocument,
    cache: Map<string, Promise<string | undefined>>
): Promise<string | undefined> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(document.directory));
    const rootPath = workspaceFolder?.uri.path;
    let directory = vscode.Uri.parse(document.directory);

    for (let depth = 0; depth < maximumProjectSearchDepth; depth++) {
        const key = directory.toString();
        let lookup = cache.get(key);
        if (lookup === undefined) {
            lookup = findProjectFileInDirectory(directory);
            cache.set(key, lookup);
        }

        const project = await lookup;
        if (project !== undefined) {
            return project;
        }

        // Stop at the workspace folder: a project outside the opened folder is not part of the
        // session, and walking past it would reach unrelated directories on the machine.
        if (rootPath !== undefined && directory.path === rootPath) {
            return undefined;
        }

        const parent = dirnameUri(directory);
        if (parent.path === directory.path) {
            return undefined;
        }

        directory = parent;
    }

    return undefined;
}

async function findProjectFileInDirectory(directory: vscode.Uri): Promise<string | undefined> {
    if (ignoredDirectoryNames.has(basename(directory))) {
        return undefined;
    }

    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(directory);
    } catch {
        // The directory can disappear between the walk starting and this read, and unreadable
        // directories simply mean there is no project here.
        return undefined;
    }

    // Sort so that a directory containing several project files always resolves to the same one.
    const projectFiles = entries
        .filter(([name, type]) => type === vscode.FileType.File && hasProjectFileExtension(name))
        .map(([name]) => name)
        .sort();
    return projectFiles.length > 0 ? vscode.Uri.joinPath(directory, projectFiles[0]).fsPath : undefined;
}

function hasProjectFileExtension(name: string): boolean {
    const normalized = name.toLocaleLowerCase('en-US');
    return projectFileExtensions.some((extension) => normalized.endsWith(`.${extension}`));
}

/**
 * Reads a schema fragment through the VS Code file system so that it works with any file system
 * provider, and refuses anything that is not a reasonably sized regular file. Fragments are
 * contributed by third-party NuGet packages, so their size is treated as untrusted input.
 */
async function readSegment(segmentPath: string, outputChannel: vscode.LogOutputChannel): Promise<string | undefined> {
    const uri = vscode.Uri.file(segmentPath);
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        if ((stat.type & vscode.FileType.File) !== vscode.FileType.File) {
            outputChannel.warn(`JSON schema segment '${segmentPath}' is not a file.`);
            return undefined;
        }

        if (stat.size > maximumSegmentBytes) {
            outputChannel.warn(
                `JSON schema segment '${segmentPath}' is larger than the ${maximumSegmentBytes}-byte limit.`
            );
            return undefined;
        }

        return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    } catch {
        return undefined;
    }
}

function createFileWatchers(patterns: readonly vscode.GlobPattern[], listener: () => void): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];
    for (const pattern of patterns) {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        disposables.push(
            watcher,
            watcher.onDidCreate(listener),
            watcher.onDidChange(listener),
            watcher.onDidDelete(listener)
        );
    }

    return vscode.Disposable.from(...disposables);
}

function basename(uri: vscode.Uri): string {
    return basenameOfPath(uri.path);
}

function basenameOfPath(value: string): string {
    const separator = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'));
    return separator >= 0 ? value.slice(separator + 1) : value;
}

function dirname(value: string): string {
    const separator = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'));
    if (separator > 0) {
        return value.slice(0, separator);
    }

    // `/app` has the root as its parent, while a value without any separator has no parent at all.
    return separator === 0 ? '/' : value;
}

function dirnameUri(uri: vscode.Uri): vscode.Uri {
    return uri.with({ path: dirname(uri.path) });
}
