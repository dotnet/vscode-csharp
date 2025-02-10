/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ProvideDiagnosticSignature, ProvideWorkspaceDiagnosticSignature, vsdiag } from 'vscode-languageclient/node';
import { languageServerOptions } from '../../shared/options';

export async function provideDiagnostics(
    document: vscode.TextDocument | vscode.Uri,
    previousResultId: string | undefined,
    token: vscode.CancellationToken,
    next: ProvideDiagnosticSignature
) {
    const result = await next(document, previousResultId, token);
    tryUpdateInformationDiagnostics(result);
    return result;
}

export async function provideWorkspaceDiagnostics(
    resultIds: vsdiag.PreviousResultId[],
    token: vscode.CancellationToken,
    resultReporter: vsdiag.ResultReporter,
    next: ProvideWorkspaceDiagnosticSignature
) {
    const result = await next(resultIds, token, (chunk) => {
        chunk?.items.forEach(tryUpdateInformationDiagnostics);
        resultReporter(chunk);
    });
    return result;
}

function tryUpdateInformationDiagnostics(report: vsdiag.DocumentDiagnosticReport | null | undefined) {
    if (report?.kind === vsdiag.DocumentDiagnosticReportKind.full && languageServerOptions.reportInformationAsHint) {
        report.items.forEach((item) => {
            if (item.severity === vscode.DiagnosticSeverity.Information) {
                item.severity = vscode.DiagnosticSeverity.Hint;
            }
        });
    }
}
