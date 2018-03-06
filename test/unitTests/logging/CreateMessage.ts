/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageType } from "../../../src/omnisharp/messageType";

export const CommandDotNetRestoreStart = () => ({
    type: MessageType.CommandDotNetRestoreStart
});
