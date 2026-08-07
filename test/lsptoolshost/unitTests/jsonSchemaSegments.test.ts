/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { describe, expect, test } from '@jest/globals';
import {
    isAppSettingsFileName,
    jsonSchemaDialect,
    matchJsonSchemaFilePattern,
    maximumSegmentDepth,
    mergeJsonSchemaSegments,
    parseJsonSchemaSegment,
    parseMsBuildJsonSchemaSegments,
} from '../../../src/shared/jsonSchema/jsonSchemaSegments';

describe('JSON schema segment MSBuild output parsing', () => {
    const projectPath = path.resolve('src', 'app', 'app.csproj');

    test('reads items and resolves relative paths against the project', () => {
        const absolute = path.resolve('packages', 'aspire.npgsql', 'ConfigurationSchema.json');
        const output = JSON.stringify({
            Items: {
                JsonSchemaSegment: [
                    { Identity: 'schemas/local.json', FilePathPattern: 'appsettings\\..*json' },
                    { Identity: 'ignored', FullPath: absolute, FilePathPattern: 'appsettings\\..*json' },
                ],
            },
        });

        expect(parseMsBuildJsonSchemaSegments(output, projectPath)).toEqual({
            diagnostics: [],
            segments: [
                {
                    path: path.resolve(path.dirname(projectPath), 'schemas', 'local.json'),
                    filePathPattern: 'appsettings\\..*json',
                },
                { path: absolute, filePathPattern: 'appsettings\\..*json' },
            ],
        });
    });

    test('tolerates CLI output printed around the JSON payload', () => {
        const output = [
            'Welcome to .NET!',
            JSON.stringify({ Items: { JsonSchemaSegment: [] } }),
            'Some trailing notice',
        ].join('\n');

        expect(parseMsBuildJsonSchemaSegments(output, projectPath)).toEqual({ diagnostics: [], segments: [] });
    });

    test.each([['{ "Items": {} }'], ['{ }']])('returns no segments and no diagnostics for %s', (output) => {
        expect(parseMsBuildJsonSchemaSegments(output, projectPath)).toEqual({ diagnostics: [], segments: [] });
    });

    test.each([
        ['not json at all', 'did not contain a JSON object'],
        ['[]', 'was not an object'],
        ['{ "Items": { "JsonSchemaSegment": {} } }', 'did not contain a JsonSchemaSegment item array'],
    ])('reports a diagnostic for %s', (output, expectedDiagnostic) => {
        const result = parseMsBuildJsonSchemaSegments(output, projectPath);

        expect(result.segments).toEqual([]);
        expect(result.diagnostics).toEqual([expect.stringContaining(expectedDiagnostic)]);
    });

    test('skips malformed items and keeps the valid ones', () => {
        const absolute = path.resolve('packages', 'yarp', 'ConfigurationSchema.json');
        const output = JSON.stringify({
            Items: {
                JsonSchemaSegment: [
                    'not-an-object',
                    { FilePathPattern: 'appsettings\\..*json' },
                    { FullPath: absolute },
                    { FullPath: `${absolute}\0.json`, FilePathPattern: 'appsettings\\..*json' },
                    { FullPath: absolute, FilePathPattern: 'appsettings\\..*json' },
                ],
            },
        });

        const result = parseMsBuildJsonSchemaSegments(output, projectPath);

        expect(result.segments).toEqual([{ path: absolute, filePathPattern: 'appsettings\\..*json' }]);
        expect(result.diagnostics).toEqual([
            expect.stringContaining('item 0'),
            expect.stringContaining('did not contain a path'),
            expect.stringContaining('did not contain FilePathPattern metadata'),
            expect.stringContaining('invalid path'),
        ]);
    });
});

describe('JSON schema segment parsing and sanitization', () => {
    const sourcePath = path.resolve('ConfigurationSchema.json');

    test('accepts comments and trailing commas', () => {
        const result = parseJsonSchemaSegment(
            sourcePath,
            `{
                // Contributed by the Aspire.Npgsql package.
                "type": "object",
                "properties": { "Aspire": { "type": "object" } },
            }`
        );

        expect(result).toEqual({
            diagnostics: [],
            schema: { type: 'object', properties: { Aspire: { type: 'object' } } },
        });
    });

    test('reports malformed JSON without throwing', () => {
        const result = parseJsonSchemaSegment(sourcePath, '{ "type": }');

        expect(result.schema).toBeUndefined();
        expect(result.diagnostics).toEqual([expect.stringContaining('Unable to parse JSON schema segment')]);
    });

    test('reports a segment that is not an object', () => {
        const result = parseJsonSchemaSegment(sourcePath, '[1, 2, 3]');

        expect(result.schema).toBeUndefined();
        expect(result.diagnostics).toEqual([expect.stringContaining('must contain a JSON object')]);
    });

    test('removes identity keywords so a segment cannot re-root the merged document', () => {
        const result = parseJsonSchemaSegment(
            sourcePath,
            JSON.stringify({
                $schema: 'https://example.invalid/meta.json',
                $id: 'https://example.invalid/segment.json',
                id: 'legacy',
                properties: { Aspire: { $id: 'nested', type: 'object' } },
            })
        );

        expect(result.schema).toEqual({ properties: { Aspire: { type: 'object' } } });
        expect(result.diagnostics).toEqual([]);
    });

    test('keeps local references and drops references that would be fetched remotely', () => {
        const result = parseJsonSchemaSegment(
            sourcePath,
            JSON.stringify({
                definitions: { npgsql: { type: 'object' } },
                properties: {
                    Aspire: { $ref: '#/definitions/npgsql' },
                    Remote: { $ref: 'https://example.invalid/evil.json' },
                    Relative: { $ref: '../../../etc/passwd' },
                },
            })
        );

        expect(result.schema).toEqual({
            definitions: { npgsql: { type: 'object' } },
            properties: {
                Aspire: { $ref: '#/definitions/npgsql' },
                Remote: {},
                Relative: {},
            },
        });
        expect(result.diagnostics).toEqual([
            expect.stringContaining('https://example.invalid/evil.json'),
            expect.stringContaining('../../../etc/passwd'),
        ]);
    });

    test('truncates a segment that nests beyond the supported depth', () => {
        let nested = '{}';
        for (let depth = 0; depth < maximumSegmentDepth + 5; depth++) {
            nested = `{ "properties": ${nested} }`;
        }

        const result = parseJsonSchemaSegment(sourcePath, nested);

        expect(result.schema).toBeDefined();
        expect(result.diagnostics).toEqual([expect.stringContaining('nests more than')]);
    });
});

describe('JsonSchemaSegment FilePathPattern matching', () => {
    test.each([
        // The pattern every shipping producer emits (Aspire, YARP, the Azure SDK, OpenAI).
        ['appsettings\\..*json', 'appsettings.json', true],
        ['appsettings\\..*json', 'appsettings.Development.json', true],
        ['appsettings\\..*json', 'appSettings.PRODUCTION.json', true],
        ['appsettings\\..*json', 'launchSettings.json', false],
        ['appsettings\\.json', 'appsettings.Development.json', false],
        // .NET's Regex.IsMatch is an unanchored search unless the pattern says otherwise.
        ['settings', 'appsettings.json', true],
        ['^appsettings', 'appsettings.json', true],
        ['^settings', 'appsettings.json', false],
        ['json$', 'appsettings.json', true],
        ['appsettings$', 'appsettings.json', false],
        // Quantifiers applied to a literal.
        ['appsettings\\.?json', 'appsettingsjson', true],
        ['a+ppsettings', 'appsettings.json', true],
    ])('matches %s against %s', (pattern, fileName, expected) => {
        expect(matchJsonSchemaFilePattern(pattern, fileName)).toEqual({ matches: expected });
    });

    test.each([
        ['appsettings(.+)+\\.json', "'('"],
        ['appsettings[a-z]*\\.json', "'['"],
        ['appsettings|launchsettings', "'|'"],
        ['appsettings\\d\\.json', "the escape '\\d'"],
        ['appsettings\\', 'a trailing \\'],
        ['*appsettings', "a '*' quantifier without a preceding character"],
    ])('reports %s as unsupported instead of executing it', (pattern, expectedDetail) => {
        expect(matchJsonSchemaFilePattern(pattern, 'appsettings.Development.json')).toEqual({
            matches: false,
            diagnostic: expect.stringContaining(expectedDetail),
        });
    });

    test('rejects patterns and file names outside the supported bounds', () => {
        expect(matchJsonSchemaFilePattern('', 'appsettings.json')).toEqual({
            matches: false,
            diagnostic: expect.stringContaining('between 1 and 256 characters'),
        });
        expect(matchJsonSchemaFilePattern('a'.repeat(257), 'appsettings.json')).toEqual({
            matches: false,
            diagnostic: expect.stringContaining('between 1 and 256 characters'),
        });
        expect(matchJsonSchemaFilePattern('appsettings\\..*json', `${'a'.repeat(513)}.json`)).toEqual({
            matches: false,
            diagnostic: expect.stringContaining('512-character matching limit'),
        });
    });

    test('evaluates a pattern that would backtrack catastrophically in a regular expression engine', () => {
        // `a*a*a*...b` against a long run of 'a' is the canonical ReDoS input. The memoized matcher
        // answers it immediately, whereas a RegExp built from the same producer-supplied pattern
        // would hang the extension host.
        const pattern = `^${'a*'.repeat(24)}b$`;
        const start = Date.now();

        expect(matchJsonSchemaFilePattern(pattern, 'a'.repeat(200))).toEqual({ matches: false });
        expect(Date.now() - start).toBeLessThan(2_000);
    });

    test.each([
        ['appsettings.json', true],
        ['appSettings.Development.json', true],
        ['appsettings.json.bak', false],
        ['launchSettings.json', false],
        ['appsettings', false],
    ])('classifies %s as an appsettings document', (fileName, expected) => {
        expect(isAppSettingsFileName(fileName)).toBe(expected);
    });
});

describe('JSON schema segment merging', () => {
    const aspirePath = path.resolve('a-aspire.schema.json');
    const yarpPath = path.resolve('b-yarp.schema.json');

    test('produces a neutral schema when nothing contributes a segment', () => {
        expect(mergeJsonSchemaSegments([])).toEqual({
            schema: { $schema: jsonSchemaDialect },
            conflicts: [],
            unresolvedReferences: [],
        });
    });

    test('deep merges disjoint sections from multiple packages', () => {
        const merged = mergeJsonSchemaSegments([
            {
                path: aspirePath,
                schema: {
                    type: 'object',
                    properties: { Aspire: { type: 'object', properties: { Npgsql: { type: 'object' } } } },
                },
            },
            {
                path: yarpPath,
                schema: {
                    type: 'object',
                    properties: { ReverseProxy: { type: 'object' } },
                },
            },
        ]);

        expect(merged).toEqual({
            conflicts: [],
            unresolvedReferences: [],
            schema: {
                $schema: jsonSchemaDialect,
                type: 'object',
                properties: {
                    Aspire: { type: 'object', properties: { Npgsql: { type: 'object' } } },
                    ReverseProxy: { type: 'object' },
                },
            },
        });
    });

    test('unions composition keywords instead of discarding them', () => {
        const merged = mergeJsonSchemaSegments([
            { path: aspirePath, schema: { required: ['Aspire'], allOf: [{ title: 'aspire' }] } },
            { path: yarpPath, schema: { required: ['Aspire', 'ReverseProxy'], allOf: [{ title: 'yarp' }] } },
        ]);

        expect(merged.conflicts).toEqual([]);
        expect(merged.schema.required).toEqual(['Aspire', 'ReverseProxy']);
        expect(merged.schema.allOf).toEqual([{ title: 'aspire' }, { title: 'yarp' }]);
    });

    test('keeps the first value and reports the conflict when segments disagree', () => {
        const merged = mergeJsonSchemaSegments([
            { path: yarpPath, schema: { properties: { Shared: { type: 'string' } } } },
            { path: aspirePath, schema: { properties: { Shared: { type: 'integer' } } } },
        ]);

        // Segments merge in ordinal path order, so the alphabetically first segment wins.
        expect(merged.schema.properties).toEqual({ Shared: { type: 'integer' } });
        expect(merged.conflicts).toEqual([
            { pointer: '#/properties/Shared/type', keptSource: aspirePath, ignoredSource: yarpPath },
        ]);
    });

    test('treats values that are user data rather than schemas as opaque', () => {
        const merged = mergeJsonSchemaSegments([
            { path: aspirePath, schema: { properties: { Shared: { default: { a: 1 }, enum: [1, 2] } } } },
            { path: yarpPath, schema: { properties: { Shared: { default: { b: 2 }, enum: [3] } } } },
        ]);

        expect(merged.schema.properties).toEqual({ Shared: { default: { a: 1 }, enum: [1, 2] } });
        expect(merged.conflicts).toEqual([
            { pointer: '#/properties/Shared/default', keptSource: aspirePath, ignoredSource: yarpPath },
            { pointer: '#/properties/Shared/enum', keptSource: aspirePath, ignoredSource: yarpPath },
        ]);
    });

    test('is deterministic regardless of the order segments are supplied in', () => {
        const segments = [
            { path: aspirePath, schema: { properties: { Aspire: { type: 'object' } }, type: 'object' } },
            { path: yarpPath, schema: { properties: { ReverseProxy: { type: 'object' } }, type: 'object' } },
        ];

        expect(JSON.stringify(mergeJsonSchemaSegments(segments).schema)).toBe(
            JSON.stringify(mergeJsonSchemaSegments([...segments].reverse()).schema)
        );
    });

    test('does not let the merged result alias the input schema', () => {
        const schema = { properties: { Aspire: { type: 'object' } } };
        const merged = mergeJsonSchemaSegments([{ path: aspirePath, schema }]);

        (merged.schema.properties as { Aspire: { type: string } }).Aspire.type = 'string';

        expect(schema.properties.Aspire.type).toBe('object');
    });

    test('keeps references that a segment defines and drops the ones nothing defines', () => {
        // Aspire.Npgsql points its Logging:LogLevel entries at `#/definitions/logLevelThreshold`,
        // which is defined by the SchemaStore appsettings document rather than by the fragment.
        // Each jsonValidation association resolves as its own document, so that pointer has no
        // target here and has to be removed to avoid an unresolvable reference problem.
        const merged = mergeJsonSchemaSegments([
            {
                path: aspirePath,
                schema: {
                    definitions: { npgsql: { type: 'object' } },
                    properties: {
                        Aspire: { $ref: '#/definitions/npgsql' },
                        Logging: { $ref: '#/definitions/logLevelThreshold' },
                        Described: { $ref: '#/definitions/missing', description: 'kept' },
                        Root: { $ref: '#' },
                    },
                },
            },
        ]);

        expect(merged.schema.properties).toEqual({
            Aspire: { $ref: '#/definitions/npgsql' },
            Described: { description: 'kept' },
            Logging: {},
            Root: { $ref: '#' },
        });
        expect(merged.unresolvedReferences).toEqual(['#/definitions/logLevelThreshold', '#/definitions/missing']);
    });

    test('resolves references through arrays and escaped pointer segments', () => {
        const merged = mergeJsonSchemaSegments([
            {
                path: aspirePath,
                schema: {
                    definitions: { 'a/b': { type: 'object' } },
                    allOf: [{ title: 'first' }],
                    properties: {
                        Escaped: { $ref: '#/definitions/a~1b' },
                        Indexed: { $ref: '#/allOf/0' },
                        OutOfRange: { $ref: '#/allOf/1' },
                    },
                },
            },
        ]);

        expect(merged.schema.properties).toEqual({
            Escaped: { $ref: '#/definitions/a~1b' },
            Indexed: { $ref: '#/allOf/0' },
            OutOfRange: {},
        });
        expect(merged.unresolvedReferences).toEqual(['#/allOf/1']);
    });

    test('resolves a reference satisfied by a different segment', () => {
        const merged = mergeJsonSchemaSegments([
            { path: aspirePath, schema: { properties: { Aspire: { $ref: '#/definitions/shared' } } } },
            { path: yarpPath, schema: { definitions: { shared: { type: 'object' } } } },
        ]);

        expect(merged.schema.properties).toEqual({ Aspire: { $ref: '#/definitions/shared' } });
        expect(merged.unresolvedReferences).toEqual([]);
    });
});
