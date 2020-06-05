/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ParsedEnvironmentFile } from '../../src/coreclr-debug/ParsedEnvironmentFile';
import { should, expect } from 'chai';

suite("ParsedEnvironmentFile", () => {
    suiteSetup(() => should());

    test("Add single variable", () => {
        const content = `MyName=VALUE`;
        const fakeConfig: { [key: string]: any } = {};
        const result = ParsedEnvironmentFile.CreateFromContent(content, "TestEnvFileName", fakeConfig["env"]);

        expect(result.Warning).to.be.null;
        result.Env["MyName"].should.equal("VALUE");
    });

    test("Handle quoted values", () => {
        const content = `MyName="VALUE"`;
        const fakeConfig: { [key: string]: any } = {};
        const result = ParsedEnvironmentFile.CreateFromContent(content, "TestEnvFileName", fakeConfig["env"]);

        expect(result.Warning).to.be.null;
        result.Env["MyName"].should.equal("VALUE");
    });

    test("Handle BOM", () => {
        const content = "\uFEFFMyName=VALUE";
        const fakeConfig: { [key: string]: any } = {};
        const result = ParsedEnvironmentFile.CreateFromContent(content, "TestEnvFileName", fakeConfig["env"]);

        expect(result.Warning).to.be.null;
        result.Env["MyName"].should.equal("VALUE");
    });

    test("Add multiple variables", () => {
        const content = `
MyName1=Value1
MyName2=Value2

`;
        const fakeConfig: { [key: string]: any } = {};
        const result = ParsedEnvironmentFile.CreateFromContent(content, "TestEnvFileName", fakeConfig["env"]);

        expect(result.Warning).to.be.null;
        result.Env["MyName1"].should.equal("Value1");
        result.Env["MyName2"].should.equal("Value2");
    });

    test("Update variable", () => {
        const content = `
MyName1=Value1
MyName2=Value2

`;
        const initialEnv: { [key: string]: any } = {
            "MyName1": "Value7",
            "ThisShouldNotChange": "StillHere"
        };
        const result = ParsedEnvironmentFile.CreateFromContent(content, "TestEnvFileName", initialEnv);

        expect(result.Warning).to.be.null;
        result.Env["MyName1"].should.equal("Value1");
        result.Env["MyName2"].should.equal("Value2");
        result.Env["ThisShouldNotChange"].should.equal("StillHere");
    });

    test("Handle comments", () => {
        const content = `# This is an environment file
MyName1=Value1
# This is a comment in the middle of the file
MyName2=Value2
`;
        const fakeConfig: { [key: string]: any } = {};
        const result = ParsedEnvironmentFile.CreateFromContent(content, "TestEnvFileName", fakeConfig["env"]);

        expect(result.Warning).to.be.null;
        result.Env["MyName1"].should.equal("Value1");
        result.Env["MyName2"].should.equal("Value2");
    });

    test("Handle invalid lines", () => {
        const content = `
This_Line_Is_Wrong
MyName1=Value1
MyName2=Value2

`;
        const fakeConfig: { [key: string]: any } = {};
        const result = ParsedEnvironmentFile.CreateFromContent(content, "TestEnvFileName", fakeConfig["env"]);

        result.Warning.should.startWith("Ignoring non-parseable lines in envFile TestEnvFileName");
        result.Env["MyName1"].should.equal("Value1");
        result.Env["MyName2"].should.equal("Value2");
    });
});
