/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Options } from "../omnisharp/options";
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { vscode } from "../vscodeAdapter";
import 'rxjs/add/operator/take';
import Disposable, { IDisposable } from "../Disposable";

export default class OptionStream {
    private optionStream: BehaviorSubject<Options>;
    private disposable: IDisposable;

    constructor(vscode: vscode) {
        this.optionStream = new BehaviorSubject<Options>(Options.Read(vscode));
        this.disposable = vscode.workspace.onDidChangeConfiguration(e => this.optionStream.next(Options.Read(vscode)));
    }

    public dispose = () => {
        this.disposable.dispose();
    }

    public subscribe(observer: (options: Options) => void): Disposable {
        return new Disposable(this.optionStream.subscribe(observer));
    }

    public Options(): Options {
        let options = this.optionStream.value;
        if (!options) {
            throw new Error("Error reading Omnisharp options");
        }

        return options;
    }
}