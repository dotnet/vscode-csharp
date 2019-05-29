/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SetNextStatementHelpers } from '../../src/coreclr-debug/setNextStatementHelpers';
import { DebugProtocol } from 'vscode-debugprotocol';
import { should } from 'chai';

suite("SetNextStatementHelpers", () => {
    suiteSetup(() => should());

    test("makeLabelsUnique handles distinct label names", () => {
        
        const targets: DebugProtocol.GotoTarget[] = [
            {
                id: 1000,
                label: "Example.dll!MyClass.A()",
                line: 100,
                column: 12,
                endLine: 100,
                endColumn: 16
            },
            {
                id: 1001,
                label: "Example.dll!MyClass.B()",
                line: 110,
                column: 14,
                endLine: 110,
                endColumn: 25
            }
        ];

        const labelDict: { [key: string]: DebugProtocol.GotoTarget } = SetNextStatementHelpers.makeLabelsUnique(targets);

        targets.length.should.equal(2);
        targets[0].label.should.equal("Example.dll!MyClass.A()");
        targets[1].label.should.equal("Example.dll!MyClass.B()");
        labelDict["Example.dll!MyClass.A()"].id.should.equal(1000);
        labelDict["Example.dll!MyClass.B()"].id.should.equal(1001);
    });

    test("makeLabelsUnique handles different source ranges", () => {
        
        const targets: DebugProtocol.GotoTarget[] = [
            {
                id: 1000,
                label: "Example.dll!MyClass.MyFunction()",
                line: 100,
                column: 12,
                endLine: 100,
                endColumn: 16
            },
            {
                id: 1001,
                label: "Example.dll!MyClass.MyFunction()",
                line: 100,
                column: 14,
                endLine: 100,
                endColumn: 25
            }
        ];

        const labelDict: { [key: string]: DebugProtocol.GotoTarget } = SetNextStatementHelpers.makeLabelsUnique(targets);

        targets.length.should.equal(2);
        targets[0].label.should.equal("Example.dll!MyClass.MyFunction() : source position (100,12)-(100,16)");
        targets[1].label.should.equal("Example.dll!MyClass.MyFunction() : source position (100,14)-(100,25)");
        labelDict["Example.dll!MyClass.MyFunction() : source position (100,12)-(100,16)"].id.should.equal(1000);
        labelDict["Example.dll!MyClass.MyFunction() : source position (100,14)-(100,25)"].id.should.equal(1001);
    });

    test("makeLabelsUnique handles idential source positions", () => {
        
        const targets: DebugProtocol.GotoTarget[] = [
            {
                id: 1000,
                label: "Example.dll!MyClass.MyFunction()",
                line: 100,
                column: 12,
                endLine: 100,
                endColumn: 16
            },
            {
                id: 1001,
                label: "Example.dll!MyClass.MyFunction()",
                line: 100,
                column: 12,
                endLine: 100,
                endColumn: 16
            }
        ];

        const labelDict: { [key: string]: DebugProtocol.GotoTarget } = SetNextStatementHelpers.makeLabelsUnique(targets);

        targets.length.should.equal(2);
        targets[0].label.should.equal("1: Example.dll!MyClass.MyFunction()");
        targets[1].label.should.equal("2: Example.dll!MyClass.MyFunction()");
        labelDict["1: Example.dll!MyClass.MyFunction()"].id.should.equal(1000);
        labelDict["2: Example.dll!MyClass.MyFunction()"].id.should.equal(1001);
    });
});