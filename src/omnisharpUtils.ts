/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {OmnisharpServer} from './omnisharpServer';
import * as proto from './protocol';

export function requestWorkspaceInformation(server: OmnisharpServer) {
    return server.makeRequest<proto.WorkspaceInformationResponse>(proto.Projects)
} 