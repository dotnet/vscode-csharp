/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode } from "../vscodeAdapter";
import { BaseEvent, ReportIssue } from "../omnisharp/loggingEvents";

export class ReportIssueObserver {

    constructor(private vscode: vscode) {
    }

    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case ReportIssue.name:
                let issue = <ReportIssue>event;
                let encodedBody = encodeURIComponent(issue.body);
                const queryStringPrefix: string = "?";
                const fullUrl =  `${issue.url}${queryStringPrefix}body=${encodedBody}`;
                this.vscode.commands.executeCommand("vscode.open", this.vscode.Uri.parse(fullUrl));
                break;
        }
    }
}