/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OpenURLObserver } from "../../../src/observers/ReportIssueObserver";
import { vscode } from "../../../src/vscodeAdapter";
import { getFakeVsCode } from "../testAssets/Fakes";
import { OpenURL } from "../../../src/omnisharp/loggingEvents";
import { expect } from "chai";

suite("ReportIssueObserver", () => {
    let observer: OpenURLObserver;
    let vscode: vscode;
    let commands: Array<string>;
    let valueToBeParsed: string;
    const url = "someUrl";
    const body = "someBody";

    setup(() => {
        vscode = getFakeVsCode();
        commands = [];
        valueToBeParsed = undefined;
        vscode.commands.executeCommand = (command: string, ...rest: any[]) => {
            commands.push(command);
            return undefined;
        };
        vscode.Uri.parse = (value: string) => {
            valueToBeParsed = value;
            return undefined;
        };
        observer = new OpenURLObserver(vscode);
    });

    test("Execute command is called with the vscode.open command", () => {
        let event = new OpenURL(url, body);
        observer.post(event);
        expect(commands).to.be.deep.equal(["vscode.open"]);
    });

    test("Url appended with the query string prefix and the body is passed to the rest parameter in executeCommand via vscode.uri.parse ", () => {
        let event = new OpenURL(url, body);
        observer.post(event);
        expect(valueToBeParsed).to.be.equal(`${url}?body=${body}`);
    });
});