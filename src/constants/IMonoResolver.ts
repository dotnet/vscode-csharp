/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Options } from "../omnisharp/options";
import { MonoInformation } from "./MonoInformation";

export interface IMonoResolver {
    getGlobalMonoInfo(options: Options): Promise<MonoInformation>;
}