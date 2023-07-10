/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ParsedEnvironmentFile } from '../../src/coreclrDebug/parsedEnvironmentFile';
import { use, should, expect } from 'chai';
import * as chaiString from 'chai-string';

use(chaiString);

suite('ParsedEnvironmentFile', () => {
    suiteSetup(() => should());

    test('Add single variable', () => {
        const content = `MyName=VALUE`;
        const result = ParsedEnvironmentFile.CreateFromContent(content, 'TestEnvFileName', undefined);

        expect(result.Warning).to.be.undefined;
        result.Env['MyName'].should.equal('VALUE');
    });

    test('Handle quoted values', () => {
        const content = `MyName="VALUE"`;
        const result = ParsedEnvironmentFile.CreateFromContent(content, 'TestEnvFileName', undefined);

        expect(result.Warning).to.be.undefined;
        result.Env['MyName'].should.equal('VALUE');
    });

    test('Handle BOM', () => {
        const content = '\uFEFFMyName=VALUE';
        const result = ParsedEnvironmentFile.CreateFromContent(content, 'TestEnvFileName', undefined);

        expect(result.Warning).to.be.undefined;
        result.Env['MyName'].should.equal('VALUE');
    });

    test('Add multiple variables', () => {
        const content = `
MyName1=Value1
MyName2=Value2

`;
        const result = ParsedEnvironmentFile.CreateFromContent(content, 'TestEnvFileName', undefined);

        expect(result.Warning).to.be.undefined;
        result.Env['MyName1'].should.equal('Value1');
        result.Env['MyName2'].should.equal('Value2');
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

        expect(result.Warning).to.be.undefined;
        result.Env['CommonKey'].should.equal('InitialValue');
        result.Env['MyName2'].should.equal('Value2');
        result.Env['ThisShouldNotChange'].should.equal('StillHere');
    });

    test('Take last value', () => {
        const content = `
Key=FirstValue
Key=SecondValue
`;
        const result = ParsedEnvironmentFile.CreateFromContent(content, 'TestEnvFileName', undefined);

        expect(result.Warning).to.be.undefined;
        result.Env['Key'].should.equal('SecondValue');
    });

    test('Handle comments', () => {
        const content = `# This is an environment file
MyName1=Value1
# This is a comment in the middle of the file
MyName2=Value2
`;
        const result = ParsedEnvironmentFile.CreateFromContent(content, 'TestEnvFileName', undefined);

        expect(result.Warning).to.be.undefined;
        result.Env['MyName1'].should.equal('Value1');
        result.Env['MyName2'].should.equal('Value2');
    });

    test('Handle invalid lines', () => {
        const content = `
This_Line_Is_Wrong
MyName1=Value1
MyName2=Value2

`;
        const result = ParsedEnvironmentFile.CreateFromContent(content, 'TestEnvFileName', undefined);

        expect(result.Warning).not.to.be.undefined;
        result.Warning!.should.startWith('Ignoring non-parseable lines in envFile TestEnvFileName');
        result.Env['MyName1'].should.equal('Value1');
        result.Env['MyName2'].should.equal('Value2');
    });
});
