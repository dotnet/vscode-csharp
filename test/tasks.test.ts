/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from '../src/vscodeAdapter';

import { should } from 'chai';

suite("Tasks generation: project.json", () => {
    suiteSetup(() => should());

    test("build task should be visible for C# project.json workspace", (done) => {
        let foo : Thenable<vscode.Task[]> = vscode.getRegisteredTaskProvider().provider.provideTasks() as Thenable<vscode.Task[]>;
        foo.then(t => {
            console.log(t);
            done();
        });
    });
});
