/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CancellationToken, Diagnostic, Uri } from 'vscode';
import { RoslynLanguageServer } from '../roslynLanguageServer';

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
        console.log('build started');
        const langServer = await this._languageServerPromise;
        langServer.clearDiagnostics();
    }

    public async reportBuildResult(buildDiagnostics: Array<[Uri, Diagnostic[]]>): Promise<void> {
        console.log('received ' + buildDiagnostics.length + ' diagnostics');

        const langServer = await this._languageServerPromise;
        langServer.setBuildDiagnostics(buildDiagnostics);
    }
}
