/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Options } from "../../../src/omnisharp/options";

export function getEmptyOptions(): Options {
    return new Options("", "", false, "", false, 0, 0, false, false, false, false, false, [], false, false, false, 0, 0, false, false, false, false, false, false, false, false, undefined, "", "");
}
