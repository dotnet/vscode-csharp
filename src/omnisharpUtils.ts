/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {OmnisharpServer} from './omnisharpServer';
import * as protocol from './protocol';

export function requestWorkspaceInformation(server: OmnisharpServer) {
    return server.makeRequest<protocol.WorkspaceInformationResponse>(protocol.Requests.Projects)
} 