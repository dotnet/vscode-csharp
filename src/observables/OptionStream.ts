/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Options } from "../omnisharp/options";
import { Subject } from "rxjs/Subject";
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { vscode } from "../vscodeAdapter";

export default class OptionStream {
    private optionStream: BehaviorSubject<Options>;
    private optionChangeDebouncer: Subject<void>;

    constructor(vscode: vscode) {
        this.optionChangeDebouncer = new Subject<void>();
        this.optionChangeDebouncer.debounceTime(1000).subscribe(() => { this.optionStream.next(Options.Read(vscode)); });
        this.optionStream = new BehaviorSubject<Options>(Options.Read(vscode));
    }

    public post() {
        this.optionChangeDebouncer.next();
    }

    public subscribe(observer: (options: Options) => void) {
        return this.optionStream.subscribe(observer);
    }
}