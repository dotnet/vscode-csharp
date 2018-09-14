/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MonoInformation } from "../monoInformation";
import { Options } from "../options";

export interface IMonoResolver {
    shouldUseGlobalMono(options: Options): Promise<MonoInformation>;
}