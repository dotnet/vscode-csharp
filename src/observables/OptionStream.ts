/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Options } from "../omnisharp/options";
import { Subject } from "rxjs/Subject";
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { vscode } from "../vscodeAdapter";
import 'rxjs/add/operator/take';
import Disposable from "../Disposable";

export default class OptionStream {
    private optionStream: BehaviorSubject<Options>;
    private optionChangeDebouncer: Subject<void>;

    constructor(vscode: vscode) {
        this.optionStream = new BehaviorSubject<Options>(Options.Read(vscode));
        this.optionChangeDebouncer = new Subject<void>();
        this.optionChangeDebouncer.debounceTime(1000).subscribe(() => { this.optionStream.next(Options.Read(vscode)); });
    }

    public post() {
        this.optionChangeDebouncer.next();
    }

    public subscribe(observer: (options: Options) => void): Disposable {
        return new Disposable(this.optionStream.subscribe(observer));
    }

    public async GetLatestOptions(): Promise<Options> {
        return this.optionStream.take(1).toPromise();
    }
}