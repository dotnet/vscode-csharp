/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { readConfigurations } from '../../../src/lsptoolshost/options/configurationMiddleware';

describe('configurationMiddleware.readConfigurations', () => {
    const getConfiguration = jest.fn<typeof vscode.workspace.getConfiguration>();
    const uriParse = jest.fn<typeof vscode.Uri.parse>();

    beforeEach(() => {
        jest.resetAllMocks();
        vscode.workspace.getConfiguration = getConfiguration;
        vscode.Uri.parse = uriParse;
    });

    test('reads scoped client configuration values when scopeUri is provided', () => {
        const scopedSettings = {
            get: jest.fn().mockImplementation((...args: unknown[]) => {
                const name = args[0] as string;
                return name === 'dotnet.formatting.organizeImportsOnFormat' ? 'true' : undefined;
            }),
        } as unknown as vscode.WorkspaceConfiguration;
        const uri = { fsPath: '/workspace/Program.cs' } as vscode.Uri;

        uriParse.mockReturnValue(uri);
        getConfiguration.mockReturnValue(scopedSettings);

        const values = readConfigurations({
            items: [
                {
                    section: 'csharp|formatting.dotnet_organize_imports_on_format',
                    scopeUri: 'file:///workspace/Program.cs',
                },
            ],
        });

        expect(values).toEqual(['true']);
        expect(uriParse).toHaveBeenCalledWith('file:///workspace/Program.cs');
        expect(getConfiguration).toHaveBeenCalledWith(undefined, { languageId: 'csharp', uri });
        expect(scopedSettings.get).toHaveBeenCalledWith('dotnet.formatting.organizeImportsOnFormat');
    });

    test('reads scoped fallback vscode formatting configuration when explicit client setting is absent', () => {
        const scopedSettings = {
            get: jest.fn().mockImplementation((...args: unknown[]) => {
                const name = args[0] as string;
                return name === 'editor.indentSize' ? '2' : undefined;
            }),
        } as unknown as vscode.WorkspaceConfiguration;
        const uri = { fsPath: '/workspace/Program.cs' } as vscode.Uri;

        uriParse.mockReturnValue(uri);
        getConfiguration.mockReturnValue(scopedSettings);

        const values = readConfigurations({
            items: [
                {
                    section: 'csharp|code_style.formatting.indentation_and_spacing.indent_size',
                    scopeUri: 'file:///workspace/Program.cs',
                },
            ],
        });

        expect(values).toEqual(['2']);
        expect(getConfiguration).toHaveBeenCalledWith(undefined, { languageId: 'csharp', uri });
        expect(getConfiguration).toHaveBeenCalledWith('', { languageId: 'csharp', uri });
        expect(scopedSettings.get).toHaveBeenCalledWith('codeStyle.formatting.indentationAndSpacing.indentSize');
        expect(scopedSettings.get).toHaveBeenCalledWith('editor.indentSize');
    });

    test('resolves indentSize=tabSize through scoped vscode formatting configuration', () => {
        const scopedSettings = {
            get: jest.fn().mockImplementation((...args: unknown[]) => {
                const name = args[0] as string;
                if (name === 'codeStyle.formatting.indentationAndSpacing.indentSize') {
                    return undefined;
                }

                if (name === 'editor.indentSize') {
                    return 'tabSize';
                }

                if (name === 'editor.tabSize') {
                    return '2';
                }

                return undefined;
            }),
        } as unknown as vscode.WorkspaceConfiguration;
        const uri = { fsPath: '/workspace/Program.cs' } as vscode.Uri;

        uriParse.mockReturnValue(uri);
        getConfiguration.mockReturnValue(scopedSettings);

        const values = readConfigurations({
            items: [
                {
                    section: 'csharp|code_style.formatting.indentation_and_spacing.indent_size',
                    scopeUri: 'file:///workspace/Program.cs',
                },
            ],
        });

        expect(values).toEqual(['2']);
        expect(scopedSettings.get).toHaveBeenCalledWith('editor.indentSize');
        expect(scopedSettings.get).toHaveBeenCalledWith('editor.tabSize');
    });
});
