/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HostExecutableInformation } from './hostExecutableInformation';

export interface IHostExecutableResolver {
    getHostExecutableInfo(): Promise<HostExecutableInformation>;
}
