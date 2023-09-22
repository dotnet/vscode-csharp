/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CancellationToken } from 'vscode';

interface IBuildResultDiagnostics {
    buildStarted(cancellationToken?: CancellationToken): Promise<void>;
    reportBuildResult(buildDiagnostics: RegExpExecArray[], cancellationToken?: CancellationToken): Promise<void>;
}

export class BuildResultDiagnostics implements IBuildResultDiagnostics {
    public async buildStarted(): Promise<void> {
        console.log('build started');
    }

    public async reportBuildResult(buildDiagnostics: RegExpExecArray[]): Promise<void> {
        console.log('received ' + buildDiagnostics.length + ' diagnostics');
    }
}
