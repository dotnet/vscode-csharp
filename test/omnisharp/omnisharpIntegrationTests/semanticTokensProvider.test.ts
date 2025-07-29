/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll } from '@jest/globals';
import * as vscode from 'vscode';
import * as path from 'path';
import { activateCSharpExtension, describeIfNotRazorOrGenerator } from './integrationHelpers';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';

interface ExpectedToken {
    startLine: number;
    character: number;
    length: number;
    tokenClassifiction: string;
}

async function assertTokens(fileUri: vscode.Uri, expected: ExpectedToken[] | null): Promise<void> {
    const legend = <vscode.SemanticTokensLegend>(
        await vscode.commands.executeCommand('vscode.provideDocumentSemanticTokensLegend', fileUri)
    );
    const actual = <vscode.SemanticTokens>(
        await vscode.commands.executeCommand('vscode.provideDocumentSemanticTokens', fileUri)
    );

    if (!actual) {
        expect(expected).toBeNull();
        return;
    }

    const actualRanges = [];
    let lastLine = 0;
    let lastCharacter = 0;
    for (let i = 0; i < actual.data.length; i += 5) {
        const lineDelta = actual.data[i],
            charDelta = actual.data[i + 1],
            len = actual.data[i + 2],
            typeIdx = actual.data[i + 3],
            modSet = actual.data[i + 4];
        const line = lastLine + lineDelta;
        const character = lineDelta === 0 ? lastCharacter + charDelta : charDelta;
        const tokenClassifiction = [
            legend.tokenTypes[typeIdx],
            ...legend.tokenModifiers.filter((_, i) => modSet & (1 << i)),
        ].join('.');
        actualRanges.push(t(line, character, len, tokenClassifiction));
        lastLine = line;
        lastCharacter = character;
    }
    expect(actualRanges).toStrictEqual(expected);
}

describeIfNotRazorOrGenerator(`SemanticTokensProvider: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    beforeAll(async function () {
        const activation = await activateCSharpExtension();

        const fileName = 'semantictokens.cs';
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;

        fileUri = vscode.Uri.file(path.join(projectDirectory, fileName));
        await vscode.commands.executeCommand('vscode.open', fileUri);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Semantic Highlighting returns null when disabled', async () => {
        const csharpConfig = vscode.workspace.getConfiguration('csharp');
        await csharpConfig.update('semanticHighlighting.enabled', false, vscode.ConfigurationTarget.Global);

        await assertTokens(fileUri, /*expected*/ null);
    });

    test('Semantic Highlighting returns classified tokens when enabled', async () => {
        const csharpConfig = vscode.workspace.getConfiguration('csharp');
        await csharpConfig.update('semanticHighlighting.enabled', true, vscode.ConfigurationTarget.Global);

        await assertTokens(fileUri, [
            // 0:namespace Test
            _keyword('namespace', 0, 0),
            _namespace('Test', 0, 10),
            // 1:{
            _punctuation('{', 1, 0),
            // 2:    public class TestProgram
            _keyword('public', 2, 4),
            _keyword('class', 2, 11),
            _class('TestProgram', 2, 17),
            // 3:    {
            _punctuation('{', 3, 4),
            // 4:        public static int TestMain(string[] args)
            _keyword('public', 4, 8),
            _keyword('static', 4, 15),
            _keyword('int', 4, 22),
            _staticMethod('TestMain', 4, 26),
            _punctuation('(', 4, 34),
            _keyword('string', 4, 35),
            _punctuation('[', 4, 41),
            _punctuation(']', 4, 42),
            _parameter('args', 4, 44),
            _punctuation(')', 4, 48),
            // 5:        {
            _punctuation('{', 5, 8),
            // 6:            System.Console.WriteLine(string.Join(',', args));
            _namespace('System', 6, 12),
            _operator('.', 6, 18),
            _staticClass('Console', 6, 19),
            _operator('.', 6, 26),
            _staticMethod('WriteLine', 6, 27),
            _punctuation('(', 6, 36),
            _keyword('string', 6, 37),
            _operator('.', 6, 43),
            _staticMethod('Join', 6, 44),
            _punctuation('(', 6, 48),
            _string("','", 6, 49),
            _punctuation(')', 6, 52),
            _parameter('args', 6, 54),
            _punctuation(')', 6, 58),
            _punctuation(')', 6, 59),
            _punctuation(';', 6, 60),
            // 7:            return 0;
            _controlKeyword('return', 7, 12),
            _number('0', 7, 19),
            _punctuation(';', 7, 20),
            // 8:        }
            _punctuation('}', 8, 8),
            // 9:    }
            _punctuation('}', 9, 4),
            //10: }
            _punctuation('}', 10, 0),
        ]);
    });
});

function t(startLine: number, character: number, length: number, tokenClassifiction: string): ExpectedToken {
    return { startLine, character, length, tokenClassifiction };
}

const _keyword = (text: string, line: number, col: number) => t(line, col, text.length, 'keyword');
const _controlKeyword = (text: string, line: number, col: number) => t(line, col, text.length, 'controlKeyword');
const _punctuation = (text: string, line: number, col: number) => t(line, col, text.length, 'punctuation');
const _operator = (text: string, line: number, col: number) => t(line, col, text.length, 'operator');
const _number = (text: string, line: number, col: number) => t(line, col, text.length, 'number');
const _string = (text: string, line: number, col: number) => t(line, col, text.length, 'string');
const _namespace = (text: string, line: number, col: number) => t(line, col, text.length, 'namespace');
const _class = (text: string, line: number, col: number) => t(line, col, text.length, 'class');
const _staticClass = (text: string, line: number, col: number) => t(line, col, text.length, 'class.static');
const _staticMethod = (text: string, line: number, col: number) => t(line, col, text.length, 'method.static');
const _parameter = (text: string, line: number, col: number) => t(line, col, text.length, 'parameter');
