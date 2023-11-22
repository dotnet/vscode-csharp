/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect } from '@jest/globals';
import { ParsedEnvironmentFile } from '../../src/coreclrDebug/parsedEnvironmentFile';

describe('ParsedEnvironmentFile', () => {
    test('Add single variable', () => {
        const content = `MyName=VALUE`;
        const result = ParsedEnvironmentFile.CreateFromContent(content, 'TestEnvFileName', undefined);

        expect(result.Warning).toBe(undefined);
        expect(result.Env['MyName']).toEqual('VALUE');
    });

    test('Handle quoted values', () => {
        const content = `MyName="VALUE"`;
        const result = ParsedEnvironmentFile.CreateFromContent(content, 'TestEnvFileName', undefined);

        expect(result.Warning).toBe(undefined);
        expect(result.Env['MyName']).toEqual('VALUE');
    });

    test('Handle BOM', () => {
        const content = '\uFEFFMyName=VALUE';
        const result = ParsedEnvironmentFile.CreateFromContent(content, 'TestEnvFileName', undefined);

        expect(result.Warning).toBe(undefined);
        expect(result.Env['MyName']).toEqual('VALUE');
    });

    test('Add multiple variables', () => {
        const content = `
MyName1=Value1
MyName2=Value2

`;
        const result = ParsedEnvironmentFile.CreateFromContent(content, 'TestEnvFileName', undefined);

        expect(result.Warning).toBe(undefined);
        expect(result.Env['MyName1']).toEqual('Value1');
        expect(result.Env['MyName2']).toEqual('Value2');
    });

    test('Not override variables', () => {
        const content = `
CommonKey=NewValue
MyName2=Value2

`;
        const initialEnv = {
            CommonKey: 'InitialValue',
            ThisShouldNotChange: 'StillHere',
        };
        const result = ParsedEnvironmentFile.CreateFromContent(content, 'TestEnvFileName', initialEnv);

        expect(result.Warning).toBe(undefined);
        expect(result.Env['CommonKey']).toEqual('InitialValue');
        expect(result.Env['MyName2']).toEqual('Value2');
        expect(result.Env['ThisShouldNotChange']).toEqual('StillHere');
    });

    test('Take last value', () => {
        const content = `
Key=FirstValue
Key=SecondValue
`;
        const result = ParsedEnvironmentFile.CreateFromContent(content, 'TestEnvFileName', undefined);

        expect(result.Warning).toBe(undefined);
        expect(result.Env['Key']).toEqual('SecondValue');
    });

    test('Handle comments', () => {
        const content = `# This is an environment file
MyName1=Value1
# This is a comment in the middle of the file
MyName2=Value2
`;
        const result = ParsedEnvironmentFile.CreateFromContent(content, 'TestEnvFileName', undefined);

        expect(result.Warning).toBe(undefined);
        expect(result.Env['MyName1']).toEqual('Value1');
        expect(result.Env['MyName2']).toEqual('Value2');
    });

    test('Handle invalid lines', () => {
        const content = `
This_Line_Is_Wrong
MyName1=Value1
MyName2=Value2

`;
        const result = ParsedEnvironmentFile.CreateFromContent(content, 'TestEnvFileName', undefined);

        expect(result.Warning).not.toBe(undefined);
        expect(result.Warning!.startsWith('Ignoring non-parseable lines in envFile TestEnvFileName')).toBe(true);
        expect(result.Env['MyName1']).toEqual('Value1');
        expect(result.Env['MyName2']).toEqual('Value2');
    });
});
