/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode } from '../../vscodeAdapter';
import { Observable, Observer } from 'rxjs';
import { publishBehavior } from 'rxjs/operators';

export default function createOptionStream(vscode: vscode): Observable<void> {
    return Observable.create((observer: Observer<void>) => {
        const disposable = vscode.workspace.onDidChangeConfiguration((e) => {
            //if the omnisharp or csharp configuration are affected only then read the options
            if (
                e.affectsConfiguration('dotnet') ||
                e.affectsConfiguration('omnisharp') ||
                e.affectsConfiguration('csharp')
            ) {
                observer.next();
            }
        });

        return () => disposable.dispose();
    })
        .pipe(
            publishBehavior(() => {
                return;
            })
        )
        .refCount();
}
