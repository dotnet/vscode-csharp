/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { ISolutionSnapshotProvider, SolutionSnapshotId } from './ISolutionSnapshotProvider';

/**
 * Brokered service implementation.
 */
export class SolutionSnapshotProvider implements ISolutionSnapshotProvider {
    constructor(private _languageServerPromise: Promise<RoslynLanguageServer>) {}
    public async registerSolutionSnapshot(token: vscode.CancellationToken): Promise<SolutionSnapshotId> {
        const languageServer = await this._languageServerPromise;
        return languageServer.registerSolutionSnapshot(token);
    }
}
