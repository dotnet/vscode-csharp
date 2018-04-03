/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode, StatusBarItem } from '../vscodeAdapter';
import { BaseEvent } from '../omnisharp/loggingEvents';

export abstract class BaseStatusBarItemObserver {

    constructor(private vscode: vscode, private statusBarItem: StatusBarItem) {
    }

    public SetAndShowStatusBar(text: string, command: string, color?: string) {
        this.statusBarItem.text = text;
        this.statusBarItem.command = command;
        this.statusBarItem.color = color;
        this.statusBarItem.show();
    }

    public ResetAndHideStatusBar() {
        this.statusBarItem.text = undefined;
        this.statusBarItem.command = undefined;
        this.statusBarItem.color = undefined;
        this.statusBarItem.hide();
    }

    abstract post: (event: BaseEvent) => void;
}