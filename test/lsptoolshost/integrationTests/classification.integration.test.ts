/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { activateCSharpExtension, closeAllEditorsAsync, openFileInWorkspaceAsync } from './integrationHelpers';
import { describe, beforeAll, beforeEach, afterAll, test, expect, afterEach } from '@jest/globals';

describe(`Classification Tests`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    beforeEach(async () => {
        await openFileInWorkspaceAsync(path.join('src', 'app', 'semantictokens.cs'));
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    afterEach(async () => {
        await closeAllEditorsAsync();
    });

    test('Semantic classification returns correct token types', async () => {
        const expectedTokens: Token[] = [
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
        ];

        const tokens = await getTokens();

        expect(tokens).toStrictEqual(expectedTokens);
    });
});

async function getTokens(): Promise<Token[]> {
    const legend = <vscode.SemanticTokensLegend>(
        await vscode.commands.executeCommand(
            'vscode.provideDocumentSemanticTokensLegend',
            vscode.window.activeTextEditor!.document.uri
        )
    );

    const actual = <vscode.SemanticTokens>(
        await vscode.commands.executeCommand(
            'vscode.provideDocumentSemanticTokens',
            vscode.window.activeTextEditor!.document.uri
        )
    );

    expect(legend).toBeDefined();
    expect(actual).toBeDefined();

    const actualRanges: Array<Token> = [];
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
        actualRanges.push({
            startLine: line,
            character: character,
            length: len,
            tokenClassifiction: tokenClassifiction,
        });
        lastLine = line;
        lastCharacter = character;
    }
    return actualRanges;
}

interface Token {
    startLine: number;
    character: number;
    length: number;
    tokenClassifiction: string;
}

function t(startLine: number, character: number, length: number, tokenClassifiction: string): Token {
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
