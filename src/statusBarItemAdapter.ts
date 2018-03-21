/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscodeAdapter from './vscodeAdapter';
import * as vscode from 'vscode';

export class StatusBarItemAdapter implements vscodeAdapter.StatusBarItem {

    alignment: vscodeAdapter.StatusBarAlignment;
    priority: number;
    text: string;
    tooltip: string;
    get color(): string{
        return this.statusBarItem.color as string;
    }
    set color(value: string) {
        this.statusBarItem.color = value;
    }
    command: string;
    show(): void {
        this.statusBarItem.show();
    }
    hide(): void {
        this.statusBarItem.hide();
    }
    dispose(): void {
        this.statusBarItem.dispose();
    }
    constructor(private statusBarItem: vscode.StatusBarItem) {
    }
}