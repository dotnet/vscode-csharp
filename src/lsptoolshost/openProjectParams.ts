/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DocumentUri } from 'vscode-languageclient/node';

export class OpenProjectParams {
    constructor(public readonly projects: DocumentUri[]) {}
}
