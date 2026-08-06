/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { ParseError, parse, printParseErrorCode } from 'jsonc-parser';

export type JsonObject = { [key: string]: unknown };

export const appSettingsSchemaStoreUrl = 'https://json.schemastore.org/appsettings';

export interface JsonSchemaSegmentItem {
    path: string;
    filePathPattern: string;
}

export interface JsonSchemaSegmentItemsResult {
    segments: JsonSchemaSegmentItem[];
    diagnostics: string[];
}

export interface JsonSchemaSegmentParseResult {
    schema?: JsonObject;
    diagnostic?: string;
}

export interface JsonSchemaSegment {
    path: string;
    schema: JsonObject;
}

export interface JsonSchemaMergeConflict {
    path: string;
    keptSource: string;
    ignoredSource: string;
}

export interface JsonSchemaMergeResult {
    schema: JsonObject;
    conflicts: JsonSchemaMergeConflict[];
}

export function parseMsBuildJsonSchemaSegments(output: string, projectPath: string): JsonSchemaSegmentItemsResult {
    let parsedOutput: unknown;
    try {
        parsedOutput = JSON.parse(output);
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

    if (!isJsonObject(items) || !Array.isArray(items.JsonSchemaSegment)) {
        return {
            segments: [],
            diagnostics: [`MSBuild JSON for '${projectPath}' did not contain a JsonSchemaSegment item array.`],
        };
    }

    const segments: JsonSchemaSegmentItem[] = [];
    const diagnostics: string[] = [];
    for (const [index, item] of items.JsonSchemaSegment.entries()) {
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

        segments.push({
            path: path.isAbsolute(itemPath)
                ? path.normalize(itemPath)
                : path.resolve(path.dirname(projectPath), itemPath),
            filePathPattern,
        });
    }

    return { segments, diagnostics };
}

export function parseJsonSchemaSegment(sourcePath: string, content: string): JsonSchemaSegmentParseResult {
    const errors: ParseError[] = [];
    const schema: unknown = parse(content, errors, {
        allowTrailingComma: true,
        disallowComments: false,
    });

    if (errors.length > 0) {
        const error = errors[0];
        return {
            diagnostic: `Unable to parse JSON schema segment '${sourcePath}': ${printParseErrorCode(error.error)} at offset ${error.offset}.`,
        };
    }

    if (!isJsonObject(schema)) {
        return {
            diagnostic: `JSON schema segment '${sourcePath}' must contain a JSON object.`,
        };
    }

    return { schema };
}

export function isAppSettingsSchemaPattern(filePathPattern: string): boolean {
    try {
        const pattern = new RegExp(`^(?:${filePathPattern})$`, 'i');
        return pattern.test('appsettings.json') || pattern.test('appsettings.Development.json');
    } catch {
        return false;
    }
}

export function mergeJsonSchemaSegments(segments: readonly JsonSchemaSegment[]): JsonSchemaMergeResult {
    const schema: JsonObject = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        allOf: [{ $ref: appSettingsSchemaStoreUrl }],
    };
    const conflicts: JsonSchemaMergeConflict[] = [];
    const owners = new Map<string, string>();
    registerOwnership(schema, '#', appSettingsSchemaStoreUrl, owners);

    for (const segment of [...segments].sort((left, right) => compareOrdinal(left.path, right.path))) {
        const segmentSchema = cloneJsonValue(segment.schema) as JsonObject;
        delete segmentSchema.$schema;
        mergeJsonObjects(schema, segmentSchema, '#', segment.path, owners, conflicts);
    }

    return {
        schema: sortJsonObject(schema),
        conflicts,
    };
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

const compatibleArrayKeywords = new Set(['allOf', 'examples', 'required']);

function mergeJsonObjects(
    target: JsonObject,
    source: JsonObject,
    pointer: string,
    sourcePath: string,
    owners: Map<string, string>,
    conflicts: JsonSchemaMergeConflict[]
): void {
    for (const key of Object.keys(source).sort()) {
        const childPointer = `${pointer}/${escapeJsonPointer(key)}`;
        const sourceValue = source[key];
        if (!(key in target)) {
            target[key] = cloneJsonValue(sourceValue);
            registerOwnership(sourceValue, childPointer, sourcePath, owners);
            continue;
        }

        const targetValue = target[key];
        if (areJsonValuesEqual(targetValue, sourceValue)) {
            continue;
        }

        if (isJsonObject(targetValue) && isJsonObject(sourceValue) && key !== 'const' && key !== 'default') {
            mergeJsonObjects(targetValue, sourceValue, childPointer, sourcePath, owners, conflicts);
            continue;
        }

        if (Array.isArray(targetValue) && Array.isArray(sourceValue) && compatibleArrayKeywords.has(key)) {
            target[key] = mergeJsonArrays(targetValue, sourceValue);
            continue;
        }

        conflicts.push({
            path: childPointer,
            keptSource: owners.get(childPointer) ?? appSettingsSchemaStoreUrl,
            ignoredSource: sourcePath,
        });
    }
}

function mergeJsonArrays(target: readonly unknown[], source: readonly unknown[]): unknown[] {
    const merged = target.map(cloneJsonValue);
    const values = new Set(merged.map(canonicalStringify));
    for (const value of source) {
        const serialized = canonicalStringify(value);
        if (!values.has(serialized)) {
            values.add(serialized);
            merged.push(cloneJsonValue(value));
        }
    }

    return merged;
}

function registerOwnership(value: unknown, pointer: string, sourcePath: string, owners: Map<string, string>): void {
    owners.set(pointer, sourcePath);
    if (isJsonObject(value)) {
        for (const [key, child] of Object.entries(value)) {
            registerOwnership(child, `${pointer}/${escapeJsonPointer(key)}`, sourcePath, owners);
        }
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

function compareOrdinal(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}
