/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { ParseError, parse, printParseErrorCode } from 'jsonc-parser';

/**
 * Pure helpers for the `JsonSchemaSegment` MSBuild item feature. Nothing in this file may depend on
 * `vscode` so that the parsing, matching and merging rules can be unit tested directly.
 *
 * NuGet packages contribute partial JSON schemas for `appsettings.json` by adding items to their
 * `buildTransitive` targets, for example:
 *
 *   <ItemGroup>
 *     <JsonSchemaSegment Include="$(MSBuildThisFileDirectory)..\..\ConfigurationSchema.json"
 *                        FilePathPattern="appsettings\..*json" />
 *   </ItemGroup>
 *
 * See https://github.com/microsoft/aspire/blob/main/src/Components/Common/Package.targets and
 * https://github.com/dotnet/yarp/blob/main/src/Common/Package.targets for shipping examples.
 */

export type JsonObject = { [key: string]: unknown };

/**
 * `$schema` dialect used for the document we synthesize. The segments themselves are draft-07 and
 * VS Code's JSON language service composes our document with the SchemaStore `appsettings` schema.
 */
export const jsonSchemaDialect = 'http://json-schema.org/draft-07/schema#';

/**
 * Upper bound on a single segment file. Segments are small generated documents; anything larger is
 * treated as untrusted input rather than parsed into the editor's schema cache.
 */
export const maximumSegmentBytes = 1024 * 1024;

/**
 * Upper bound on how many distinct segment files are merged for one schema request. Even very large
 * package graphs contribute a handful of segments, so this only guards against pathological input.
 */
export const maximumSegmentCount = 64;

/**
 * Upper bound on segment nesting. This bounds the recursive sanitize/merge walks so that a hostile
 * or corrupt segment cannot exhaust the extension host stack.
 */
export const maximumSegmentDepth = 64;

const maximumFilePathPatternLength = 256;
const maximumFileNameLength = 512;

export interface JsonSchemaSegmentItem {
    /** Absolute path of the schema fragment contributed by the item. */
    path: string;
    /** `FilePathPattern` metadata; a .NET regular expression matched against the JSON file name. */
    filePathPattern: string;
}

export interface JsonSchemaSegmentItemsResult {
    segments: JsonSchemaSegmentItem[];
    diagnostics: string[];
}

export interface JsonSchemaSegmentParseResult {
    schema?: JsonObject;
    diagnostics: string[];
}

export interface JsonSchemaSegment {
    path: string;
    schema: JsonObject;
}

export interface JsonSchemaMergeConflict {
    /** JSON pointer of the conflicting node, for example `#/properties/Aspire/type`. */
    pointer: string;
    keptSource: string;
    ignoredSource: string;
}

export interface JsonSchemaMergeResult {
    schema: JsonObject;
    conflicts: JsonSchemaMergeConflict[];
    /**
     * Local `$ref` pointers that were dropped because nothing in the merged document defines them.
     * Reported so that a fragment relying on an external definition is visible in the log.
     */
    unresolvedReferences: string[];
}

export interface JsonSchemaFilePatternMatchResult {
    matches: boolean;
    diagnostic?: string;
}

/**
 * Returns true when the file name is one that the `appsettings` schema associations in package.json
 * apply to. Used to decide which open documents participate in schema routing.
 */
export function isAppSettingsFileName(fileName: string): boolean {
    const normalized = fileName.toLocaleLowerCase('en-US');
    return normalized === 'appsettings.json' || (normalized.startsWith('appsettings.') && normalized.endsWith('.json'));
}

/**
 * Parses the stdout of `dotnet msbuild <project> -getItem:JsonSchemaSegment`, which looks like:
 *
 *   {
 *     "Items": {
 *       "JsonSchemaSegment": [
 *         {
 *           "Identity": "../../ConfigurationSchema.json",
 *           "FullPath": "/home/user/.nuget/packages/aspire.npgsql/9.0.0/ConfigurationSchema.json",
 *           "FilePathPattern": "appsettings\\..*json"
 *         }
 *       ]
 *     }
 *   }
 *
 * `Items` is omitted entirely when nothing contributes the item, and MSBuild can prefix the payload
 * with unstructured text (for example an NuGet fallback-folder notice), so the JSON object is
 * located rather than assumed to start at offset zero.
 */
export function parseMsBuildJsonSchemaSegments(output: string, projectPath: string): JsonSchemaSegmentItemsResult {
    const payload = extractJsonObjectText(output);
    if (payload === undefined) {
        return {
            segments: [],
            diagnostics: [`MSBuild output for '${projectPath}' did not contain a JSON object.`],
        };
    }

    let parsedOutput: unknown;
    try {
        parsedOutput = JSON.parse(payload);
    } catch (error) {
        return {
            segments: [],
            diagnostics: [`Unable to parse MSBuild JSON for '${projectPath}': ${getErrorMessage(error)}`],
        };
    }

    if (!isJsonObject(parsedOutput)) {
        return {
            segments: [],
            diagnostics: [`MSBuild JSON for '${projectPath}' was not an object.`],
        };
    }

    const items = parsedOutput.Items;
    if (items === undefined) {
        return { segments: [], diagnostics: [] };
    }

    if (!isJsonObject(items)) {
        return {
            segments: [],
            diagnostics: [`MSBuild JSON for '${projectPath}' did not contain an Items object.`],
        };
    }

    const segmentItems = items.JsonSchemaSegment;
    if (segmentItems === undefined) {
        return { segments: [], diagnostics: [] };
    }

    if (!Array.isArray(segmentItems)) {
        return {
            segments: [],
            diagnostics: [`MSBuild JSON for '${projectPath}' did not contain a JsonSchemaSegment item array.`],
        };
    }

    const segments: JsonSchemaSegmentItem[] = [];
    const diagnostics: string[] = [];
    for (const [index, item] of segmentItems.entries()) {
        if (!isJsonObject(item)) {
            diagnostics.push(`JsonSchemaSegment item ${index} for '${projectPath}' was not an object.`);
            continue;
        }

        const itemPath = getNonEmptyString(item.FullPath) ?? getNonEmptyString(item.Identity);
        const filePathPattern = getNonEmptyString(item.FilePathPattern);
        if (itemPath === undefined) {
            diagnostics.push(`JsonSchemaSegment item ${index} for '${projectPath}' did not contain a path.`);
            continue;
        }

        if (filePathPattern === undefined) {
            diagnostics.push(
                `JsonSchemaSegment item ${index} for '${projectPath}' did not contain FilePathPattern metadata.`
            );
            continue;
        }

        // A NUL byte would be silently truncated by the platform file APIs, so reject it outright
        // rather than reading a path that is not the one MSBuild reported.
        if (itemPath.includes('\0')) {
            diagnostics.push(`JsonSchemaSegment item ${index} for '${projectPath}' contained an invalid path.`);
            continue;
        }

        segments.push({
            path: path.isAbsolute(itemPath)
                ? path.normalize(itemPath)
                : path.resolve(path.dirname(projectPath), itemPath),
            filePathPattern,
        });
    }

    return { segments, diagnostics };
}

/**
 * Parses and sanitizes a schema fragment. Segments are authored by third-party NuGet packages, so
 * the parsed document is stripped of identity and remote-reference keywords before it is merged
 * into the document we hand to the JSON language service.
 */
export function parseJsonSchemaSegment(sourcePath: string, content: string): JsonSchemaSegmentParseResult {
    const errors: ParseError[] = [];
    // Generated segments are frequently checked in with comments and trailing commas, and the JSON
    // language service tolerates both, so parse with the same leniency instead of JSON.parse.
    const schema: unknown = parse(content, errors, {
        allowTrailingComma: true,
        disallowComments: false,
    });

    if (errors.length > 0) {
        const error = errors[0];
        return {
            schema: undefined,
            diagnostics: [
                `Unable to parse JSON schema segment '${sourcePath}': ${printParseErrorCode(error.error)} at offset ${
                    error.offset
                }.`,
            ],
        };
    }

    if (!isJsonObject(schema)) {
        return {
            schema: undefined,
            diagnostics: [`JSON schema segment '${sourcePath}' must contain a JSON object.`],
        };
    }

    const diagnostics: string[] = [];
    const sanitized = sanitizeSegmentValue(schema, sourcePath, 0, diagnostics);
    if (!isJsonObject(sanitized)) {
        return {
            schema: undefined,
            diagnostics: [`JSON schema segment '${sourcePath}' was too deeply nested to be used.`],
        };
    }

    return { schema: sanitized, diagnostics };
}

/**
 * Matches an MSBuild `FilePathPattern` against a JSON file name.
 *
 * Every known producer emits a .NET regular expression (`appsettings\..*json`), and .NET's
 * `Regex.IsMatch` is an unanchored search, so this implements the same semantics. Only the subset
 * that producers actually use is supported - literals, escaped literals, `.`, and the `*`, `+` and
 * `?` quantifiers, plus the `^` and `$` anchors. Anything else is reported as a diagnostic instead
 * of being executed.
 *
 * Patterns come from third-party packages, so they are deliberately never compiled into a `RegExp`;
 * the memoized matcher below is linear in (tokens x file name length) and therefore immune to the
 * catastrophic backtracking that a pattern such as `(a+)+$` would cause.
 */
export function matchJsonSchemaFilePattern(
    filePathPattern: string,
    fileName: string
): JsonSchemaFilePatternMatchResult {
    if (filePathPattern.length === 0 || filePathPattern.length > maximumFilePathPatternLength) {
        return {
            matches: false,
            diagnostic: `JsonSchemaSegment FilePathPattern must contain between 1 and ${maximumFilePathPatternLength} characters.`,
        };
    }

    if (fileName.length > maximumFileNameLength) {
        return {
            matches: false,
            diagnostic: `JSON file name exceeds the ${maximumFileNameLength}-character matching limit.`,
        };
    }

    const parsed = parseFilePathPattern(filePathPattern);
    if (parsed.diagnostic !== undefined) {
        return { matches: false, diagnostic: parsed.diagnostic };
    }

    // File names are compared case-insensitively because appsettings files are routinely spelled
    // `appSettings.Development.json` and are matched case-insensitively on Windows and macOS.
    return { matches: matchPattern(parsed.tokens, fileName.toLocaleLowerCase('en-US')) };
}

/**
 * Deep merges schema fragments into a single document.
 *
 * Segments contribute disjoint top-level sections in practice (one per package), so a deep merge
 * produces better completion and hover text than wrapping each fragment in `allOf`. When two
 * segments disagree on the same JSON pointer the first one wins - segments are merged in ordinal
 * path order so the result is deterministic - and the discarded value is reported as a conflict so
 * that it can be surfaced in the log instead of silently disappearing.
 *
 * Arrays are unioned for the keywords where that preserves meaning (`allOf`, `anyOf`, `oneOf`,
 * `required` and `examples`); every other array is treated as an opaque value and participates in
 * conflict detection.
 *
 * Finally, local `$ref` pointers that nothing in the merged document defines are dropped. Fragments
 * are authored against the full `appsettings` schema, so they can reference a definition that lives
 * in the SchemaStore document rather than in the fragment - `Aspire.Npgsql` for example points its
 * `Logging:LogLevel` entries at `#/definitions/logLevelThreshold`. Each `jsonValidation` association
 * is resolved as its own document, so such a pointer has no target here and the JSON language
 * service reports it as an unresolvable reference on every file the schema applies to.
 */
export function mergeJsonSchemaSegments(segments: readonly JsonSchemaSegment[]): JsonSchemaMergeResult {
    const schema: JsonObject = { $schema: jsonSchemaDialect };
    const conflicts: JsonSchemaMergeConflict[] = [];
    const owners = new Map<string, string>();

    for (const segment of [...segments].sort((left, right) => compareOrdinal(left.path, right.path))) {
        mergeJsonObjects(schema, segment.schema, '#', segment.path, owners, conflicts, 0);
    }

    const unresolvedReferences = dropUnresolvedLocalReferences(schema);
    return { schema: sortJsonObject(schema), conflicts, unresolvedReferences };
}

/**
 * Removes `$ref` keywords whose JSON pointer does not resolve inside the merged document, returning
 * the pointers that were dropped. A node consisting only of `$ref` becomes the empty schema, which
 * accepts anything, so the surrounding structure and its completions survive.
 */
function dropUnresolvedLocalReferences(schema: JsonObject): string[] {
    const unresolved = new Set<string>();

    const visit = (value: unknown): void => {
        if (Array.isArray(value)) {
            for (const element of value) {
                visit(element);
            }

            return;
        }

        if (!isJsonObject(value)) {
            return;
        }

        const reference = value['$ref'];
        if (typeof reference === 'string' && !resolvesWithin(schema, reference)) {
            unresolved.add(reference);
            delete value['$ref'];
        }

        for (const child of Object.values(value)) {
            visit(child);
        }
    };

    visit(schema);
    return [...unresolved].sort(compareOrdinal);
}

function resolvesWithin(schema: JsonObject, reference: string): boolean {
    if (reference === '#') {
        return true;
    }

    if (!reference.startsWith('#/')) {
        return false;
    }

    let current: unknown = schema;
    // JSON pointer escaping: `~1` is `/` and `~0` is `~`. https://www.rfc-editor.org/rfc/rfc6901
    for (const rawSegment of reference.slice(2).split('/')) {
        const segment = decodeURIComponent(rawSegment).replace(/~1/g, '/').replace(/~0/g, '~');
        if (Array.isArray(current)) {
            const index = Number(segment);
            if (!Number.isInteger(index) || index < 0 || index >= current.length) {
                return false;
            }

            current = current[index];
            continue;
        }

        if (!isJsonObject(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
            return false;
        }

        current = current[segment];
    }

    return true;
}

interface ParsedFilePathPattern {
    tokens: FilePatternToken[];
    diagnostic?: string;
}

type FilePatternQuantifier = 'one' | 'zeroOrOne' | 'zeroOrMore' | 'oneOrMore';

interface FilePatternToken {
    /** `undefined` matches any single character, mirroring the regular expression `.`. */
    literal?: string;
    quantifier: FilePatternQuantifier;
}

// Regular expression syntax that has no equivalent in the supported subset. Encountering any of it
// means the pattern cannot be evaluated safely, so the segment is skipped and reported.
const unsupportedPatternCharacters = '()[]{}|';

// Escapes that introduce character classes or backreferences rather than a literal character.
const unsupportedEscapes = new Set('AbBcdDfGkKnpPrsStuvwWxzZ0123456789'.split(''));

const anySequence: FilePatternToken = { quantifier: 'zeroOrMore' };

function parseFilePathPattern(pattern: string): ParsedFilePathPattern {
    const normalized = pattern.toLocaleLowerCase('en-US');
    const tokens: FilePatternToken[] = [];
    let anchorStart = false;
    let anchorEnd = false;

    for (let index = 0; index < normalized.length; index++) {
        const character = normalized[index];
        if (character === '^' && index === 0) {
            anchorStart = true;
            continue;
        }

        if (character === '$' && index === normalized.length - 1) {
            anchorEnd = true;
            continue;
        }

        let token: FilePatternToken;
        if (character === '\\') {
            if (index + 1 >= normalized.length) {
                return { tokens: [], diagnostic: unsupportedPattern(pattern, 'a trailing \\') };
            }

            const escaped = normalized[++index];
            if (unsupportedEscapes.has(escaped)) {
                return { tokens: [], diagnostic: unsupportedPattern(pattern, `the escape '\\${escaped}'`) };
            }

            token = { literal: escaped, quantifier: 'one' };
        } else if (character === '.') {
            token = { quantifier: 'one' };
        } else if (unsupportedPatternCharacters.includes(character)) {
            return { tokens: [], diagnostic: unsupportedPattern(pattern, `'${character}'`) };
        } else if (character === '*' || character === '+' || character === '?') {
            return {
                tokens: [],
                diagnostic: unsupportedPattern(pattern, `a '${character}' quantifier without a preceding character`),
            };
        } else {
            token = { literal: character, quantifier: 'one' };
        }

        const quantifier = normalized[index + 1];
        if (quantifier === '*' || quantifier === '+' || quantifier === '?') {
            token.quantifier = quantifier === '*' ? 'zeroOrMore' : quantifier === '+' ? 'oneOrMore' : 'zeroOrOne';
            index++;
        }

        tokens.push(token);
    }

    // .NET's Regex.IsMatch searches the whole input instead of requiring a full match, so an
    // unanchored pattern is modelled as an implicit `.*` on the unanchored side. Keeping this in the
    // token list means matching stays a single memoized walk rather than a retry from every offset.
    return {
        tokens: [...(anchorStart ? [] : [anySequence]), ...tokens, ...(anchorEnd ? [] : [anySequence])],
    };
}

function unsupportedPattern(pattern: string, detail: string): string {
    return `JsonSchemaSegment FilePathPattern '${pattern}' uses unsupported regular expression syntax: ${detail}.`;
}

function matchPattern(tokens: readonly FilePatternToken[], value: string): boolean {
    // The result of a match attempt depends only on (token index, value index), so a visited set
    // collapses the search into a linear walk over that state space. This is what makes the matcher
    // safe to run against producer-supplied patterns that a real regular expression engine would
    // backtrack on exponentially.
    const visited = new Set<number>();
    const matches = (tokenIndex: number, valueIndex: number): boolean => {
        const key = tokenIndex * (value.length + 1) + valueIndex;
        if (visited.has(key)) {
            return false;
        }

        visited.add(key);
        if (tokenIndex === tokens.length) {
            return valueIndex === value.length;
        }

        const token = tokens[tokenIndex];
        const consumes =
            valueIndex < value.length && (token.literal === undefined || token.literal === value[valueIndex]);
        switch (token.quantifier) {
            case 'one':
                return consumes && matches(tokenIndex + 1, valueIndex + 1);
            case 'zeroOrOne':
                return matches(tokenIndex + 1, valueIndex) || (consumes && matches(tokenIndex + 1, valueIndex + 1));
            case 'oneOrMore':
                return consumes && (matches(tokenIndex, valueIndex + 1) || matches(tokenIndex + 1, valueIndex + 1));
            case 'zeroOrMore':
                return (
                    matches(tokenIndex + 1, valueIndex) ||
                    (consumes && (matches(tokenIndex, valueIndex + 1) || matches(tokenIndex + 1, valueIndex + 1)))
                );
        }
    };

    return matches(0, 0);
}

/**
 * Removes keywords that would let a segment change the identity of, or pull remote content into,
 * the schema document we synthesize:
 *
 * - `$schema`, `$id` and `id` would re-root reference resolution at a URI we do not control.
 * - a non-local `$ref` would make the JSON language service fetch an arbitrary URI on the user's
 *   behalf; local (`#/...`) references still resolve correctly because the whole segment, including
 *   its `definitions`, is merged into the same document.
 */
function sanitizeSegmentValue(value: unknown, sourcePath: string, depth: number, diagnostics: string[]): unknown {
    if (depth > maximumSegmentDepth) {
        diagnostics.push(
            `JSON schema segment '${sourcePath}' was truncated because it nests more than ${maximumSegmentDepth} levels.`
        );
        return undefined;
    }

    if (Array.isArray(value)) {
        return value
            .map((element) => sanitizeSegmentValue(element, sourcePath, depth + 1, diagnostics))
            .filter((element) => element !== undefined);
    }

    if (!isJsonObject(value)) {
        return value;
    }

    const sanitized: JsonObject = {};
    for (const [key, child] of Object.entries(value)) {
        if (key === '$schema' || key === '$id' || key === 'id') {
            continue;
        }

        if (key === '$ref') {
            if (typeof child === 'string' && child.startsWith('#')) {
                sanitized[key] = child;
            } else {
                diagnostics.push(
                    `JSON schema segment '${sourcePath}' declares a non-local $ref that was ignored: ${JSON.stringify(
                        child
                    )}.`
                );
            }

            continue;
        }

        const sanitizedChild = sanitizeSegmentValue(child, sourcePath, depth + 1, diagnostics);
        if (sanitizedChild !== undefined) {
            sanitized[key] = sanitizedChild;
        }
    }

    return sanitized;
}

/**
 * MSBuild writes the `-getItem` payload to stdout, but the .NET CLI can prepend unstructured notices
 * (first-run welcome text, NuGet fallback folder warnings). Prefer the output as-is and only fall
 * back to locating the JSON object when it does not parse on its own.
 */
function extractJsonObjectText(output: string): string | undefined {
    if (isParsableJson(output)) {
        return output;
    }

    const start = output.indexOf('{');
    const end = output.lastIndexOf('}');
    const candidate = start >= 0 && end > start ? output.slice(start, end + 1) : undefined;
    return candidate !== undefined && isParsableJson(candidate) ? candidate : undefined;
}

function isParsableJson(value: string): boolean {
    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
}

// Keywords whose arrays compose rather than conflict when two segments both declare them.
const unionArrayKeywords = new Set(['allOf', 'anyOf', 'oneOf', 'examples', 'required']);

// Keywords whose value is arbitrary user data rather than a nested schema, so a structural merge
// would corrupt them.
const opaqueValueKeywords = new Set(['const', 'default', 'enum']);

function mergeJsonObjects(
    target: JsonObject,
    source: JsonObject,
    pointer: string,
    sourcePath: string,
    owners: Map<string, string>,
    conflicts: JsonSchemaMergeConflict[],
    depth: number
): void {
    if (depth > maximumSegmentDepth) {
        return;
    }

    for (const key of Object.keys(source).sort()) {
        const childPointer = `${pointer}/${escapeJsonPointer(key)}`;
        const sourceValue = source[key];
        if (!(key in target)) {
            target[key] = cloneJsonValue(sourceValue);
            registerOwnership(sourceValue, childPointer, sourcePath, owners, depth);
            continue;
        }

        const targetValue = target[key];
        if (areJsonValuesEqual(targetValue, sourceValue)) {
            continue;
        }

        if (isJsonObject(targetValue) && isJsonObject(sourceValue) && !opaqueValueKeywords.has(key)) {
            mergeJsonObjects(targetValue, sourceValue, childPointer, sourcePath, owners, conflicts, depth + 1);
            continue;
        }

        if (Array.isArray(targetValue) && Array.isArray(sourceValue) && unionArrayKeywords.has(key)) {
            target[key] = unionJsonArrays(targetValue, sourceValue);
            continue;
        }

        conflicts.push({
            pointer: childPointer,
            keptSource: owners.get(childPointer) ?? 'the merged schema',
            ignoredSource: sourcePath,
        });
    }
}

function unionJsonArrays(target: readonly unknown[], source: readonly unknown[]): unknown[] {
    const merged = target.map(cloneJsonValue);
    const seen = new Set(merged.map(canonicalStringify));
    for (const value of source) {
        const serialized = canonicalStringify(value);
        if (!seen.has(serialized)) {
            seen.add(serialized);
            merged.push(cloneJsonValue(value));
        }
    }

    return merged;
}

function registerOwnership(
    value: unknown,
    pointer: string,
    sourcePath: string,
    owners: Map<string, string>,
    depth: number
): void {
    owners.set(pointer, sourcePath);
    if (depth > maximumSegmentDepth || !isJsonObject(value)) {
        return;
    }

    for (const [key, child] of Object.entries(value)) {
        registerOwnership(child, `${pointer}/${escapeJsonPointer(key)}`, sourcePath, owners, depth + 1);
    }
}

function cloneJsonValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(cloneJsonValue);
    }

    if (isJsonObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJsonValue(child)]));
    }

    return value;
}

function sortJsonObject(value: JsonObject): JsonObject {
    return Object.fromEntries(
        Object.keys(value)
            .sort()
            .map((key) => [key, sortJsonValue(value[key])])
    );
}

function sortJsonValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sortJsonValue);
    }

    return isJsonObject(value) ? sortJsonObject(value) : value;
}

function areJsonValuesEqual(left: unknown, right: unknown): boolean {
    return canonicalStringify(left) === canonicalStringify(right);
}

function canonicalStringify(value: unknown): string {
    return JSON.stringify(sortJsonValue(value));
}

function escapeJsonPointer(value: string): string {
    return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNonEmptyString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function compareOrdinal(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}
