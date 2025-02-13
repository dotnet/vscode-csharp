/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vscode from 'vscode';

interface IBuildResultDiagnostics {
    buildStarted(cancellationToken?: CancellationToken): Promise<void>;
    reportBuildResult(
        buildDiagnostics: { [uri: string]: vscode.Diagnostic[] },
        cancellationToken?: CancellationToken
    ): Promise<void>;
}

export class BuildResultDiagnostics implements IBuildResultDiagnostics {
    constructor(private _languageServerPromise: Promise<RoslynLanguageServer>) {}

    public async buildStarted(): Promise<void> {
        const langServer: RoslynLanguageServer = await this._languageServerPromise;
        langServer._buildDiagnosticService.clearDiagnostics();
    }

    public async reportBuildResult(buildDiagnostics: { [uri: string]: vscode.Diagnostic[] }): Promise<void> {
        const langServer: RoslynLanguageServer = await this._languageServerPromise;
        const buildOnlyIds: string[] = await langServer.getBuildOnlyDiagnosticIds(CancellationToken.None);
        await langServer._buildDiagnosticService.setBuildDiagnostics(buildDiagnostics, buildOnlyIds);
    }
}
