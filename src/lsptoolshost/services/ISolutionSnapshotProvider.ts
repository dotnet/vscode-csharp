/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { integer } from 'vscode-languageserver-protocol';

export interface ISolutionSnapshotProvider {
    /**
     * Returns the id of the current solution snapshot.
     * The id can be used to access the snapshot in the Roslyn process, until it is discarded.
     */
    registerSolutionSnapshot(token: vscode.CancellationToken): Promise<SolutionSnapshotId>;
}

export class SolutionSnapshotId {
    constructor(public Id: integer) {}
}
