/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { expect } from '@jest/globals';
import { restartLanguageServer } from './integrationHelpers';

function sortDiagnostics(diagnostics: vscode.Diagnostic[]): vscode.Diagnostic[] {
    return diagnostics.sort((a, b) => {
        const rangeCompare = a.range.start.compareTo(b.range.start);
        if (rangeCompare !== 0) {
            return rangeCompare;
        }

        return getCode(a).localeCompare(getCode(b));
    });
}

export async function waitForExpectedDiagnostics(
    assertExpectedDiagnostics: (input: [vscode.Uri, vscode.Diagnostic[]][]) => void,
    file?: vscode.Uri
): Promise<void> {
    let duration = 60 * 1000;
    const step = 500;
    let error: any = undefined;
    while (duration > 0) {
        const diagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [];
        if (file) {
            diagnostics.push([file, sortDiagnostics(vscode.languages.getDiagnostics(file))]);
        } else {
            const allDiagnostics = vscode.languages.getDiagnostics();
            for (const [uri, uriDiagnostics] of allDiagnostics) {
                diagnostics.push([uri, sortDiagnostics(uriDiagnostics)]);
            }
        }

        try {
            assertExpectedDiagnostics(diagnostics);
            return;
        } catch (e) {
            error = e;
            // Wait for a bit and try again.
            await new Promise((r) => setTimeout(r, step));
            duration -= step;
        }
    }

    throw new Error(`Polling did not succeed within the alotted duration: ${error}`);
}

export async function setBackgroundAnalysisScopes(scopes: { compiler: string; analyzer: string }): Promise<void> {
    const dotnetConfig = vscode.workspace.getConfiguration('dotnet');
    await dotnetConfig.update('backgroundAnalysis.compilerDiagnosticsScope', scopes.compiler);
    await dotnetConfig.update('backgroundAnalysis.analyzerDiagnosticsScope', scopes.analyzer);

    // Restart the language server to ensure diagnostics are reported with the correct configuration.
    // While in normal user scenarios it isn't necessary to restart the server to pickup diagnostic config changes,
    // we need to do it in integration tests for two reasons:
    //  1. We don't know when the server finishes processing the config change (its sent as a notification from client -> server).
    //  2. Even if we processed the config change, the VSCode API does not provide a way to re-request diagnostics after the config change.
    await restartLanguageServer();
}

export function getCode(diagnostic: vscode.Diagnostic): string {
    const code: {
        value: string | number;
        target: vscode.Uri;
    } = diagnostic.code as any;
    expect(code).toBeDefined();
    return code.value.toString();
}
