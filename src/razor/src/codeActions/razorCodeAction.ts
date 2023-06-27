/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { SerializableWorkspaceEdit } from '../rpc/serializableWorkspaceEdit';
import { RazorCodeActionDataParams } from './razorCodeActionDataParams';
import { RazorCodeActionResolutionParams } from './razorCodeActionResolutionParams';

export interface RazorCodeAction {
    title: string;
    edit: SerializableWorkspaceEdit;
    data: RazorCodeActionResolutionParams | RazorCodeActionDataParams;
}
