/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscodeAdapter from './vscodeAdapter';
import * as vscode from 'vscode';

export class StatusBarItemAdapter implements vscodeAdapter.StatusBarItem {

    get alignment(): vscodeAdapter.StatusBarAlignment {
        return this.statusBarItem.alignment;
    }

    get priority(): number {
        return this.statusBarItem.priority;
    }

    get text(): string {
        return this.statusBarItem.text;
    }

    set text(value: string) {
        this.statusBarItem.text = value;
    }

    get tooltip(): string {
        return this.statusBarItem.tooltip;
    }

    set tooltip(value: string) {
        this.statusBarItem.tooltip = value;
    }

    get color(): string {
        return this.statusBarItem.color as string;
    }

    set color(value: string) {
        this.statusBarItem.color = value;
    }

    get command(): string | vscode.Command {
        return this.statusBarItem.command;
    }

    set command(value: string | vscode.Command) {
        this.statusBarItem.command = value;
    }

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