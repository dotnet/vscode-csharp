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

export interface WorkspaceConfiguration {

    /**
     * Return a value from this configuration.
     *
     * @param section Configuration name, supports _dotted_ names.
     * @return The value `section` denotes or `undefined`.
     */
    get<T>(section: string): T | undefined;

    /**
     * Return a value from this configuration.
     *
     * @param section Configuration name, supports _dotted_ names.
     * @param defaultValue A value should be returned when no value could be found, is `undefined`.
     * @return The value `section` denotes or the default.
     */
    get<T>(section: string, defaultValue: T): T;

    /**
     * Check if this configuration has a certain value.
     *
     * @param section Configuration name, supports _dotted_ names.
     * @return `true` if the section doesn't resolve to `undefined`.
     */
    has(section: string): boolean;

    /**
     * Retrieve all information about a configuration setting. A configuration value
     * often consists of a *default* value, a global or installation-wide value,
     * a workspace-specific value and a folder-specific value.
     *
     * The *effective* value (returned by [`get`](#WorkspaceConfiguration.get))
     * is computed like this: `defaultValue` overwritten by `globalValue`,
     * `globalValue` overwritten by `workspaceValue`. `workspaceValue` overwritten by `workspaceFolderValue`.
     * Refer to [Settings Inheritence](https://code.visualstudio.com/docs/getstarted/settings)
     * for more information.
     *
     * *Note:* The configuration name must denote a leaf in the configuration tree
     * (`editor.fontSize` vs `editor`) otherwise no result is returned.
     *
     * @param section Configuration name, supports _dotted_ names.
     * @return Information about a configuration setting or `undefined`.
     */
    inspect<T>(section: string): { key: string; defaultValue?: T; globalValue?: T; workspaceValue?: T, workspaceFolderValue?: T } | undefined;

    /**
     * Update a configuration value. The updated configuration values are persisted.
     *
     * A value can be changed in
     *
     * - [Global configuration](#ConfigurationTarget.Global): Changes the value for all instances of the editor.
     * - [Workspace configuration](#ConfigurationTarget.Workspace): Changes the value for current workspace, if available.
     * - [Workspace folder configuration](#ConfigurationTarget.WorkspaceFolder): Changes the value for the
     * [Workspace folder](#workspace.workspaceFolders) to which the current [configuration](#WorkspaceConfiguration) is scoped to.
     *
     * *Note 1:* Setting a global value in the presence of a more specific workspace value
     * has no observable effect in that workspace, but in others. Setting a workspace value
     * in the presence of a more specific folder value has no observable effect for the resources
     * under respective [folder](#workspace.workspaceFolders), but in others. Refer to
     * [Settings Inheritence](https://code.visualstudio.com/docs/getstarted/settings) for more information.
     *
     * *Note 2:* To remove a configuration value use `undefined`, like so: `config.update('somekey', undefined)`
     *
     * Will throw error when
     * - Writing a configuration which is not registered.
     * - Writing a configuration to workspace or folder target when no workspace is opened
     * - Writing a configuration to folder target when there is no folder settings
     * - Writing to folder target without passing a resource when getting the configuration (`workspace.getConfiguration(section, resource)`)
     * - Writing a window configuration to folder target
     *
     * @param section Configuration name, supports _dotted_ names.
     * @param value The new value.
     * @param configurationTarget The [configuration target](#ConfigurationTarget) or a boolean value.
     *	- If `true` configuration target is `ConfigurationTarget.Global`.
     *	- If `false` configuration target is `ConfigurationTarget.Workspace`.
     *	- If `undefined` or `null` configuration target is
     *	`ConfigurationTarget.WorkspaceFolder` when configuration is resource specific
     *	`ConfigurationTarget.Workspace` otherwise.
     */
    update(section: string, value: any, configurationTarget?: ConfigurationTarget | boolean): Thenable<void>;

    /**
     * Readable dictionary that backs this configuration.
     */
    readonly [key: string]: any;
}

/**
 * The configuration target
 */
export enum ConfigurationTarget {
    /**
     * Global configuration
    */
    Global = 1,

    /**
     * Workspace configuration
     */
    Workspace = 2,

    /**
     * Workspace folder configuration
     */
    WorkspaceFolder = 3
}

/**
 * Represents the alignment of status bar items.
 */
export enum StatusBarAlignment {

    /**
     * Aligned to the left side.
     */
    Left = 1,

    /**
     * Aligned to the right side.
     */
    Right = 2
}


export interface StatusBarItem {

    /**
     * The alignment of this item.
     */
    readonly alignment: StatusBarAlignment;

    /**
     * The priority of this item. Higher value means the item should
     * be shown more to the left.
     */
    readonly priority: number;

    /**
     * The text to show for the entry. You can embed icons in the text by leveraging the syntax:
     *
     * `My text $(icon-name) contains icons like $(icon'name) this one.`
     *
     * Where the icon-name is taken from the [octicon](https://octicons.github.com) icon set, e.g.
     * `light-bulb`, `thumbsup`, `zap` etc.
     */
    text: string;

    /**
     * The tooltip text when you hover over this entry.
     */
    tooltip: string | undefined;

    /**
     * The foreground color for this entry.
     */
    color: string | undefined;

    /**
     * The identifier of a command to run on click. The command must be
     * [known](#commands.getCommands).
     */
    command: string | undefined;

    /**
     * Shows the entry in the status bar.
     */
    show(): void;

    /**
     * Hide the entry in the status bar.
     */
    hide(): void;

    /**
     * Dispose and free associated resources. Call
     * [hide](#StatusBarItem.hide).
     */
    dispose(): void;
}

export interface DocumentFilter {

    /**
     * A language id, like `typescript`.
     */
    language?: string;

    /**
     * A Uri [scheme](#Uri.scheme), like `file` or `untitled`.
     */
    scheme?: string;

    /**
     * A [glob pattern](#GlobPattern) that is matched on the absolute path of the document. Use a [relative pattern](#RelativePattern)
     * to filter documents to a [workspace folder](#WorkspaceFolder).
     */
    pattern?: GlobPattern;
}

export type GlobPattern = string;

export type DocumentSelector = string | DocumentFilter | (string | DocumentFilter)[];

export interface MessageOptions {

    /**
     * Indicates that this message should be modal.
     */
    modal?: boolean;
}

export interface TextEditor {

    /**
     * The document associated with this text editor. The document will be the same for the entire lifetime of this text editor.
     */
    document: any;
}

export interface MessageItem {

    /**
     * A short title like 'Retry', 'Open Log' etc.
     */
    title: string;

    /**
     * Indicates that this item replaces the default
     * 'Close' action.
     */
    isCloseAffordance?: boolean;
}
