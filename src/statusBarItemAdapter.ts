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

    get priority(): number | undefined {
        return this.statusBarItem.priority;
    }

    get text(): string {
        return this.statusBarItem.text;
    }

    set text(value: string) {
        this.statusBarItem.text = value;
    }

    get tooltip(): string {
        return <string>this.statusBarItem.tooltip;
    }

    set tooltip(value: string) {
        this.statusBarItem.tooltip = value;
    }

    get color(): string | vscode.ThemeColor | undefined {
        return this.statusBarItem.color;
    }

    set color(value: string | vscode.ThemeColor | undefined) {
        this.statusBarItem.color = value;
    }

    get command(): string | vscode.Command | undefined {
        return this.statusBarItem.command;
    }

    set command(value: string | vscode.Command | undefined) {
        this.statusBarItem.command = value;
    }

    get name(): string | undefined {
        return this.statusBarItem.name;
    }

    set name(value: string | undefined) {
        this.statusBarItem.name = value;
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
