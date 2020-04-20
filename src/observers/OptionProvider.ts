/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Options } from "../omnisharp/options";
import { Subscription, Observable } from "rxjs";
export default class OptionProvider {
    private options: Options;
    private subscription: Subscription;

    constructor(optionObservable: Observable<Options>) {
        this.subscription = optionObservable.subscribe(options => this.options = options);
    }

    public GetLatestOptions(): Options {
        if (!this.options) {
            throw new Error("Error reading OmniSharp options");
        }

        return this.options;
    }

    public dispose = () => {
        this.subscription.unsubscribe();
    }
}