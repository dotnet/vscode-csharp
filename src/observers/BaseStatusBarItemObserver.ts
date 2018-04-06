/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StatusBarItem } from '../vscodeAdapter';
import { BaseEvent } from '../omnisharp/loggingEvents';

export abstract class BaseStatusBarItemObserver {

    constructor(private statusBarItem: StatusBarItem) {
    }

    public SetTextAndShowStatusBar(text: string, command?: string, color?: string) {
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

    public SetToolTipAndShowStatusBar(text: string) {
        this.statusBarItem.tooltip = text;
        this.statusBarItem.show();
    }

    abstract post: (event: BaseEvent) => void;
}