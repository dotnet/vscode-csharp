/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface OutputChannel {

    /**
     * The human-readable name of this output channel.
     */
    readonly name: string;

    /**
     * Append the given value to the channel.
     *
     * @param value A string, falsy values will not be printed.
     */
    append(value: string): void;

    /**
     * Append the given value and a line feed character
     * to the channel.
     *
     * @param value A string, falsy values will be printed.
     */
    appendLine(value: string): void;

    /**
     * Removes all output from the channel.
     */
    clear(): void;

    /**
     * Reveal this channel in the UI.
     *
     * @param preserveFocus When `true` the channel will not take focus.
     */
    show(preserveFocus?: boolean): void;

    /**
     * ~~Reveal this channel in the UI.~~
     *
     * @deprecated Use the overload with just one parameter (`show(preserveFocus?: boolean): void`).
     *
     * @param column This argument is **deprecated** and will be ignored.
     * @param preserveFocus When `true` the channel will not take focus.
     */
    show(column?: ViewColumn, preserveFocus?: boolean): void;

    /**
     * Hide this channel from the UI.
     */
    hide(): void;

    /**
     * Dispose and free associated resources.
     */
    dispose(): void;
}

export enum ViewColumn {
    /**
     * A *symbolic* editor column representing the currently
     * active column. This value can be used when opening editors, but the
     * *resolved* [viewColumn](#TextEditor.viewColumn)-value of editors will always
     * be `One`, `Two`, `Three`, or `undefined` but never `Active`.
     */
    Active = -1,
    /**
     * The left most editor column.
     */
    One = 1,
    /**
     * The center editor column.
     */
    Two = 2,
    /**
     * The right most editor column.
     */
    Three = 3
}
