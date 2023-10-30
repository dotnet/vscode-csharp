/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Diagnostic, Uri } from 'vscode';
import { RoslynLanguageServer } from '../roslynLanguageServer';
import { CancellationToken } from 'vscode-jsonrpc';

interface IBuildResultDiagnostics {
    buildStarted(cancellationToken?: CancellationToken): Promise<void>;
    reportBuildResult(
        buildDiagnostics: Array<[Uri, Diagnostic[]]>,
        cancellationToken?: CancellationToken
    ): Promise<void>;
}

export class BuildResultDiagnostics implements IBuildResultDiagnostics {
    constructor(private _languageServerPromise: Promise<RoslynLanguageServer>) {}

    public async buildStarted(): Promise<void> {
        const langServer: RoslynLanguageServer = await this._languageServerPromise;
        langServer._buildDiagnosticService.clearDiagnostics();
    }

    public async reportBuildResult(buildDiagnostics: Array<[Uri, Diagnostic[]]>): Promise<void> {
        const langServer: RoslynLanguageServer = await this._languageServerPromise;
        const buildOnlyIds: string[] = await langServer.getBuildOnlyDiagnosticIds(CancellationToken.None);
        langServer._buildDiagnosticService.setBuildDiagnostics(buildDiagnostics, buildOnlyIds);
    }
}
