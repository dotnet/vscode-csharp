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
    color: string | ThemeColor | undefined;

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

export class RelativePattern {

    /**
     * A base file path to which this pattern will be matched against relatively.
     */
    base: string;

    /**
     * A file glob pattern like `*.{ts,js}` that will be matched on file paths
     * relative to the base path.
     *
     * Example: Given a base of `/home/work/folder` and a file path of `/home/work/folder/index.js`,
     * the file glob pattern will match on `index.js`.
     */
    pattern: string;

    /**
     * Creates a new relative pattern object with a base path and pattern to match. This pattern
     * will be matched on file paths relative to the base path.
     *
     * @param base A base file path to which this pattern will be matched against relatively.
     * @param pattern A file glob pattern like `*.{ts,js}` that will be matched on file paths
     * relative to the base path.
     */
    constructor(base: WorkspaceFolder | string, pattern: string)
}

export interface WorkspaceFolder {

    /**
     * The associated uri for this workspace folder.
     *
     * *Note:* The [Uri](#Uri)-type was intentionally chosen such that future releases of the editor can support
     * workspace folders that are not stored on the local disk, e.g. `ftp://server/workspaces/foo`.
     */
    readonly uri: Uri;

    /**
     * The name of this workspace folder. Defaults to
     * the basename of its [uri-path](#Uri.path)
     */
    readonly name: string;

    /**
     * The ordinal number of this workspace folder.
     */
    readonly index: number;
}

export type GlobPattern = string | RelativePattern;

export type DocumentSelector = string | DocumentFilter | (string | DocumentFilter)[];

export interface MessageOptions {

    /**
     * Indicates that this message should be modal.
     */
    modal?: boolean;
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

export class Uri {

    /**
     * Create an URI from a file system path. The [scheme](#Uri.scheme)
     * will be `file`.
     *
     * @param path A file system or UNC path.
     * @return A new Uri instance.
     */
    static file(path: string): Uri;

    /**
     * Create an URI from a string. Will throw if the given value is not
     * valid.
     *
     * @param value The string value of an Uri.
     * @return A new Uri instance.
     */
    static parse(value: string): Uri;

    /**
     * Use the `file` and `parse` factory functions to create new `Uri` objects.
     */
    private constructor(scheme: string, authority: string, path: string, query: string, fragment: string);

    /**
     * Scheme is the `http` part of `http://www.msft.com/some/path?query#fragment`.
     * The part before the first colon.
     */
    readonly scheme: string;

    /**
     * Authority is the `www.msft.com` part of `http://www.msft.com/some/path?query#fragment`.
     * The part between the first double slashes and the next slash.
     */
    readonly authority: string;

    /**
     * Path is the `/some/path` part of `http://www.msft.com/some/path?query#fragment`.
     */
    readonly path: string;

    /**
     * Query is the `query` part of `http://www.msft.com/some/path?query#fragment`.
     */
    readonly query: string;

    /**
     * Fragment is the `fragment` part of `http://www.msft.com/some/path?query#fragment`.
     */
    readonly fragment: string;

    /**
     * The string representing the corresponding file system path of this Uri.
     *
     * Will handle UNC paths and normalize windows drive letters to lower-case. Also
     * uses the platform specific path separator. Will *not* validate the path for
     * invalid characters and semantics. Will *not* look at the scheme of this Uri.
     */
    readonly fsPath: string;

    /**
     * Derive a new Uri from this Uri.
     *
     * ```ts
     * let file = Uri.parse('before:some/file/path');
     * let other = file.with({ scheme: 'after' });
     * assert.ok(other.toString() === 'after:some/file/path');
     * ```
     *
     * @param change An object that describes a change to this Uri. To unset components use `null` or
     *  the empty string.
     * @return A new Uri that reflects the given change. Will return `this` Uri if the change
     *  is not changing anything.
     */
    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri;

    /**
     * Returns a string representation of this Uri. The representation and normalization
     * of a URI depends on the scheme. The resulting string can be safely used with
     * [Uri.parse](#Uri.parse).
     *
     * @param skipEncoding Do not percentage-encode the result, defaults to `false`. Note that
     *	the `#` and `?` characters occuring in the path will always be encoded.
     * @returns A string representation of this Uri.
     */
    toString(skipEncoding?: boolean): string;

    /**
     * Returns a JSON representation of this Uri.
     *
     * @return An object.
     */
    toJSON(): any;
}