/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Options } from "../omnisharp/options";
import { vscode } from "../vscodeAdapter";
import 'rxjs/add/operator/take';
import 'rxjs/add/operator/publishBehavior';
import { Observable } from "rxjs/Observable";
import { Observer } from "rxjs/Observer";

export function createOptionStream(vscode: vscode): Observable<Options> {
    return Observable.create((observer: Observer<Options>) => {
        let disposable = vscode.workspace.onDidChangeConfiguration(e => {
            //if the omnisharp or csharp configuration are affected only then read the options
            if (e.affectsConfiguration('omnisharp') || e.affectsConfiguration('csharp')) {
                observer.next(Options.Read(vscode));
            }
        });

        return () => disposable.dispose();
    }).publishBehavior(Options.Read(vscode)).refCount();
}