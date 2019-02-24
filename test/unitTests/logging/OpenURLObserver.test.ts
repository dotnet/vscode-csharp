/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OpenURLObserver } from "../../../src/observers/OpenURLObserver";
import { vscode, Uri } from "../../../src/vscodeAdapter";
import { getFakeVsCode } from "../testAssets/Fakes";
import { OpenURL } from "../../../src/omnisharp/loggingEvents";
import { expect } from "chai";

suite(`${OpenURLObserver.name}`, () => {
    let observer: OpenURLObserver;
    let vscode: vscode;
    let valueToBeParsed: string;
    const url = "someUrl";
    let openExternalCalled: boolean;

    setup(() => {
        vscode = getFakeVsCode();
        openExternalCalled = false;
        valueToBeParsed = undefined;
        vscode.env.openExternal = (target: Uri) => {
            openExternalCalled = true;
            return undefined;
        };

        vscode.Uri.parse = (value: string) => {
            valueToBeParsed = value;
            return undefined;
        };

        observer = new OpenURLObserver(vscode);
    });

    test("openExternal function is called and the url is passed through the vscode.Uri.parse function", () => {
        let event = new OpenURL(url);
        observer.post(event);
        expect(valueToBeParsed).to.be.equal(url);
        expect(openExternalCalled).to.be.true;
    });
});