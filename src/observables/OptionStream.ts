/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Options } from "../omnisharp/options";
import { vscode } from "../vscodeAdapter";
import 'rxjs/add/operator/take';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import Disposable, { IDisposable } from "../Disposable";
import { Subject } from "rxjs/Subject";

export default class OptionStream {
    private optionStream: Subject<Options>;
    private disposable: IDisposable;

    constructor(vscode: vscode) {
        this.optionStream = new BehaviorSubject<Options>(Options.Read(vscode));
        this.disposable = vscode.workspace.onDidChangeConfiguration(e => {
            //if the omnisharp or csharp configuration are affected only then read the options
            if (e.affectsConfiguration('omnisharp') || e.affectsConfiguration('csharp')) {
                this.optionStream.next(Options.Read(vscode));
            }
        });
    }

    public dispose = () => {
        this.disposable.dispose();
    }

    public subscribe(observer: (options: Options) => void): Disposable {
        return new Disposable(this.optionStream.subscribe(observer));
    }
}