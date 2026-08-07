/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { afterEach, beforeAll, describe, expect, test } from '@jest/globals';
import {
    activateCSharpExtension,
    closeAllEditorsAsync,
    getFilePath,
    openFileInWorkspaceAsync,
    waitForExpectedResult,
} from './integrationHelpers';

const schemaUri = vscode.Uri.parse('csharp-appsettings-schema://schemas/appsettings.schema.json');

describe('Appsettings JSON schema segments', () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    afterEach(async () => {
        await closeAllEditorsAsync();
    });

    test('serves only the segments that apply to the open documents', async () => {
        await openFileInWorkspaceAsync('src/app/appsettings.json');

        // src/app/app.csproj contributes aspire.schema.json for every appsettings file and
        // yarp.schema.json only for appsettings.Development.json. src/lib/lib.csproj contributes
        // lib.schema.json but owns no open document.
        await waitForSchema((schema) => {
            expect(Object.keys(schema.properties ?? {})).toEqual(['Aspire']);
            expect(schema.properties.Aspire.properties.Npgsql).toBeDefined();
            // The fragment references `#/definitions/logLevelThreshold`, which only the SchemaStore
            // appsettings document defines, so the dangling pointer must have been dropped.
            expect(schema.definitions.logLevel.properties.Npgsql).toEqual({});
        });

        await openFileInWorkspaceAsync('src/app/appsettings.Development.json');

        await waitForSchema((schema) => {
            expect(Object.keys(schema.properties ?? {}).sort()).toEqual(['Aspire', 'ReverseProxy']);
        });
    }, 120_000);

    test('offers completions contributed by the segments', async () => {
        const appSettingsUri = await openFileInWorkspaceAsync('src/app/appsettings.json');
        await waitForSchema((schema) => expect(schema.properties?.Aspire).toBeDefined());

        await waitForExpectedResult(
            async () =>
                await vscode.commands.executeCommand<vscode.CompletionList>(
                    'vscode.executeCompletionItemProvider',
                    appSettingsUri,
                    new vscode.Position(0, 1)
                ),
            30_000,
            500,
            (completions) => {
                const labels = completions.items.map((item) => item.label);
                expect(labels).toEqual(expect.arrayContaining(['Aspire']));
            }
        );
    }, 120_000);

    test('does not report a schema resolution problem on appsettings files', async () => {
        const appSettingsUri = getFilePath('src/app/appsettings.json');
        await openFileInWorkspaceAsync('src/app/appsettings.json');
        await waitForSchema((schema) => expect(schema.properties?.Aspire).toBeDefined());

        const diagnostics = vscode.languages
            .getDiagnostics(appSettingsUri)
            .filter((diagnostic) => /schema/i.test(diagnostic.message));
        expect(diagnostics).toEqual([]);
    }, 120_000);
});

/**
 * The schema document is a virtual document whose content is recomputed as documents open and
 * close, so poll it rather than reading it once.
 */
async function waitForSchema(expression: (schema: any) => void): Promise<void> {
    await waitForExpectedResult(
        async () => {
            const document = await vscode.workspace.openTextDocument(schemaUri);
            return JSON.parse(document.getText());
        },
        60_000,
        500,
        expression
    );
}
