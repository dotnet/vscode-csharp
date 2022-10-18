/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Options } from "../omnisharp/options";
import { HostExecutableInformation } from "./HostExecutableInformation";

export interface IHostExecutableResolver {
    getHostExecutableInfo(options: Options): Promise<HostExecutableInformation>;
}
