/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DotnetInfo } from "../utils/getDotnetInfo";

export interface IGetDotnetInfo {
    (): Promise<DotnetInfo>;
}