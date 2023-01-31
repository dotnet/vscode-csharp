/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { SerializableWorkspaceEdit } from '../RPC/SerializableWorkspaceEdit';
import { RazorCodeActionDataParams } from './RazorCodeActionDataParams';
import { RazorCodeActionResolutionParams } from './RazorCodeActionResolutionParams';

export interface RazorCodeAction {
    title: string;
    edit: SerializableWorkspaceEdit;
    data: RazorCodeActionResolutionParams | RazorCodeActionDataParams;
}
