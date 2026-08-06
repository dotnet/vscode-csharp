/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { afterEach, describe, expect, test } from '@jest/globals';
import {
    activateCSharpExtension,
    closeAllEditorsAsync,
    getFilePath,
    waitForExpectedResult,
} from './integrationHelpers';

const appSettingsJsonSchemaUri = vscode.Uri.parse('csharp-appsettings-schema://schemas/appsettings.schema.json');

describe('Appsettings JSON schema segments', () => {
    afterEach(async () => {
        await closeAllEditorsAsync();
    });

    test('loads the custom schema URI and provides completions from all workspace segments', async () => {
        await activateCSharpExtension();

        const schemaDocument = await vscode.workspace.openTextDocument(appSettingsJsonSchemaUri);
        const schema = JSON.parse(schemaDocument.getText());
        expect(schema.properties.Aspire).toBeDefined();
        expect(schema.properties.ReverseProxy).toBeDefined();

        const appSettingsUri = getFilePath('src/app/appsettings.json');
        const document = await vscode.workspace.openTextDocument(appSettingsUri);
        await vscode.window.showTextDocument(document);

        await waitForExpectedResult(
            async () =>
                await vscode.commands.executeCommand<vscode.CompletionList>(
                    'vscode.executeCompletionItemProvider',
                    appSettingsUri,
                    new vscode.Position(0, 1)
                ),
            20_000,
            250,
            (completions) => {
                const labels = completions.items.map((item) => item.label);
                expect(labels).toEqual(expect.arrayContaining(['Aspire', 'ReverseProxy']));
            }
        );
    }, 90_000);
});
