/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfigurationChangeEvent } from "../../../src/vscodeAdapter";

export function GetConfigChangeEvent(changingConfig: string): ConfigurationChangeEvent {
    return {
        affectsConfiguration: (section: string) => section == changingConfig
    };
}