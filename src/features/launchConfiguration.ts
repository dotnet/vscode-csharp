/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DebugConfiguration } from "vscode";

export default interface LaunchConfiguration extends DebugConfiguration {
    debuggerEventsPipeName?: string;
    program?: string;
    args?: string;
    cwd?: string;
}