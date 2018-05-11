/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Options } from "../omnisharp/options";
import OptionStream from "../observables/OptionStream";

export class OptionObserver {
    private options: Options;

    constructor(optionStream: OptionStream) {
        optionStream.subscribe(options => this.options = options);
    }

    public Options(): Options {
        return this.options;
    }
}