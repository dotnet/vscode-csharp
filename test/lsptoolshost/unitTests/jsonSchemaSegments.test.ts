/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { describe, expect, test } from '@jest/globals';
import {
    appSettingsSchemaStoreUrl,
    isAppSettingsSchemaPattern,
    mergeJsonSchemaSegments,
    parseJsonSchemaSegment,
    parseMsBuildJsonSchemaSegments,
} from '../../../src/shared/jsonSchema/jsonSchemaSegments';

describe('JSON schema segment parsing', () => {
    test('parses resolved JsonSchemaSegment items from dotnet msbuild output', () => {
        const projectPath = path.resolve('workspace', 'src', 'app', 'app.csproj');
        const aspireSchemaPath = path.resolve('packages', 'aspire', 'ConfigurationSchema.json');
        const yarpSchemaPath = path.join('schemas', 'YarpSchema.json');
        const output = JSON.stringify({
            Items: {
                JsonSchemaSegment: [
                    {
                        Identity: '../schemas/AspireSchema.json',
                        FullPath: aspireSchemaPath,
                        FilePathPattern: 'appsettings\\..*json',
                    },
                    {
                        Identity: yarpSchemaPath,
                        FilePathPattern: 'appsettings(\\..*)?\\.json',
                    },
                ],
            },
        });

        const result = parseMsBuildJsonSchemaSegments(output, projectPath);

        expect(result.diagnostics).toEqual([]);
        expect(result.segments).toEqual([
            {
                path: aspireSchemaPath,
                filePathPattern: 'appsettings\\..*json',
            },
            {
                path: path.resolve(path.dirname(projectPath), yarpSchemaPath),
                filePathPattern: 'appsettings(\\..*)?\\.json',
            },
        ]);
    });

    test('reports malformed output and ignores invalid items', () => {
        const projectPath = path.resolve('workspace', 'app.csproj');

        const malformedOutput = parseMsBuildJsonSchemaSegments('{ "Items":', projectPath);
        const invalidItems = parseMsBuildJsonSchemaSegments(
            JSON.stringify({
                Items: {
                    JsonSchemaSegment: [
                        null,
                        { Identity: 42, FilePathPattern: 'appsettings.json' },
                        { Identity: 'schema.json', FilePathPattern: 42 },
                    ],
                },
            }),
            projectPath
        );

        expect(malformedOutput.segments).toEqual([]);
        expect(malformedOutput.diagnostics).toHaveLength(1);
        expect(malformedOutput.diagnostics[0]).toContain('MSBuild JSON');
        expect(invalidItems.segments).toEqual([]);
        expect(invalidItems.diagnostics).toHaveLength(3);
    });

    test('parses JSON schema segments with comments and trailing commas', () => {
        const result = parseJsonSchemaSegment(
            'aspire.schema.json',
            `{
                // Packages contribute partial appsettings schemas.
                "type": "object",
                "properties": {
                    "Aspire": {
                        "type": "object",
                    },
                },
            }`
        );

        expect(result.diagnostic).toBeUndefined();
        expect(result.schema).toEqual({
            type: 'object',
            properties: {
                Aspire: {
                    type: 'object',
                },
            },
        });
    });

    test('rejects malformed or non-object schema segments', () => {
        const malformed = parseJsonSchemaSegment('malformed.schema.json', '{ "type": }');
        const array = parseJsonSchemaSegment('array.schema.json', '[]');

        expect(malformed.schema).toBeUndefined();
        expect(malformed.diagnostic).toContain('malformed.schema.json');
        expect(array.schema).toBeUndefined();
        expect(array.diagnostic).toContain('JSON object');
    });

    test.each([
        ['appsettings\\..*json', true],
        ['appsettings(\\..*)?\\.json', true],
        ['appsettings.json', true],
        ['launchSettings\\.json', false],
        ['[', false],
    ])('classifies appsettings pattern %s', (pattern, expected) => {
        expect(isAppSettingsSchemaPattern(pattern)).toBe(expected);
    });
});

describe('JSON schema segment merging', () => {
    const aspireSegment = {
        path: 'aspire.schema.json',
        schema: {
            type: 'object',
            properties: {
                Aspire: {
                    type: 'object',
                    properties: {
                        Npgsql: {
                            type: 'object',
                        },
                    },
                },
                Shared: {
                    type: 'object',
                },
            },
            definitions: {
                logLevel: {
                    properties: {
                        Npgsql: {
                            type: 'string',
                        },
                    },
                },
            },
            $defs: {
                connection: {
                    type: 'string',
                },
            },
            required: ['Aspire', 'Shared'],
            allOf: [{ additionalProperties: true }],
        },
    };

    const yarpSegment = {
        path: 'yarp.schema.json',
        schema: {
            type: 'object',
            properties: {
                ReverseProxy: {
                    type: 'object',
                },
                Shared: {
                    type: 'string',
                },
            },
            definitions: {
                logLevel: {
                    properties: {
                        Yarp: {
                            type: 'string',
                        },
                    },
                },
            },
            $defs: {
                route: {
                    type: 'object',
                },
            },
            required: ['ReverseProxy', 'Shared'],
            allOf: [{ additionalProperties: true }, { minProperties: 1 }],
        },
    };

    test('combines Aspire and YARP-style properties, definitions, defs, and compatible arrays', () => {
        const result = mergeJsonSchemaSegments([yarpSegment, aspireSegment]);

        expect(result.schema).toEqual({
            $schema: 'http://json-schema.org/draft-07/schema#',
            $defs: {
                connection: {
                    type: 'string',
                },
                route: {
                    type: 'object',
                },
            },
            allOf: [{ $ref: appSettingsSchemaStoreUrl }, { additionalProperties: true }, { minProperties: 1 }],
            definitions: {
                logLevel: {
                    properties: {
                        Npgsql: {
                            type: 'string',
                        },
                        Yarp: {
                            type: 'string',
                        },
                    },
                },
            },
            properties: {
                Aspire: {
                    properties: {
                        Npgsql: {
                            type: 'object',
                        },
                    },
                    type: 'object',
                },
                ReverseProxy: {
                    type: 'object',
                },
                Shared: {
                    type: 'object',
                },
            },
            required: ['Aspire', 'Shared', 'ReverseProxy'],
            type: 'object',
        });
        expect(result.conflicts).toEqual([
            {
                path: '#/properties/Shared/type',
                keptSource: 'aspire.schema.json',
                ignoredSource: 'yarp.schema.json',
            },
        ]);
    });

    test('produces deterministic content regardless of discovery order', () => {
        const forward = mergeJsonSchemaSegments([aspireSegment, yarpSegment]);
        const reverse = mergeJsonSchemaSegments([yarpSegment, aspireSegment]);

        expect(JSON.stringify(reverse.schema, null, 2)).toBe(JSON.stringify(forward.schema, null, 2));
        expect(reverse.conflicts).toEqual(forward.conflicts);
    });
});
