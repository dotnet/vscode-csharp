/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export const convertToProjectCommandName = 'dotnet.convertToProject';

/**
 * Registers the `dotnet.convertToProject` command. When invoked with a URI (context menu)
 * it converts that file directly; without a URI (command palette) it shows a quick pick of
 * discoverable FBA entry points. Requires .NET 10 SDK or later.
 */
export function registerConvertToProjectCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(convertToProjectCommandName, async (uri?: vscode.Uri): Promise<void> => {
            if (uri !== undefined) {
                // Invoked from the right-click context menu with a specific file.
                await convertToProject(uri);
            } else {
                // Invoked from the command palette -- let the user pick from discoverable apps.
                await pickAndConvertToProject();
            }
        })
    );
}

/**
 * Converts the given file-based C# app to a project-based app by running
 * `dotnet project convert <file>` in an integrated terminal.
 */
async function convertToProject(uri: vscode.Uri): Promise<void> {
    // Use language ID (not extension) so files with custom language associations are accepted.
    const document =
        vscode.workspace.textDocuments.find((d) => d.uri.fsPath === uri.fsPath) ??
        (await vscode.workspace.openTextDocument(uri));

    if (document.languageId !== 'csharp') {
        vscode.window.showErrorMessage(vscode.l10n.t('Only C# files can be converted to a project.'));
        return;
    }

    await runConvertCommand(uri.fsPath);
}

/**
 * Shows a quick-pick list of discoverable FBA entry points and converts the one selected.
 *
 * All C# files are candidates. Files inside a `.csproj` cone are filtered out unless they
 * contain `#!` or `#:` markers. Open files are included via language ID; closed
 * files are matched by `.cs` extension (VS Code only exposes language IDs for open files).
 */
async function pickAndConvertToProject(): Promise<void> {
    // Collect C# files from the workspace by extension, then augment with any already-open
    // documents that VS Code treats as C# even if they lack a .cs extension.
    const csFilesByExtension = await vscode.workspace.findFiles('**/*.cs', '**/obj/**');
    const csFileSet = new Set(csFilesByExtension.map((u) => u.fsPath));

    const allCsUris: vscode.Uri[] = [...csFilesByExtension];
    for (const doc of vscode.workspace.textDocuments) {
        if (doc.languageId === 'csharp' && !csFileSet.has(doc.uri.fsPath)) {
            allCsUris.push(doc.uri);
        }
    }

    if (allCsUris.length === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t('No C# files found in the workspace.'));
        return;
    }

    // Build a set of directories that contain a .csproj so we can quickly check whether
    // a given .cs file lives inside a project cone.
    const csprojFiles = await vscode.workspace.findFiles('**/*.csproj', '**/obj/**');
    const csprojDirs = new Set(csprojFiles.map((u) => path.dirname(u.fsPath)));

    const entryPoints: vscode.QuickPickItem[] = [];

    for (const fileUri of allCsUris) {
        const filePath = fileUri.fsPath;
        const kind = detectFileBasedAppKind(filePath);

        if (shouldShowConvertToProjectOption(filePath, kind, csprojDirs)) {
            const label = path.basename(filePath);
            const description = vscode.workspace.asRelativePath(fileUri, true);
            entryPoints.push({ label, description, detail: filePath });
        }
    }

    if (entryPoints.length === 0) {
        vscode.window.showInformationMessage(
            vscode.l10n.t(
                'No file-based C# apps were found in the workspace. ' +
                    'A file-based app entry point must not be part of any `.csproj` project, ' +
                    'unless it contains a top-of-file `#!` or `#:` directive.'
            )
        );
        return;
    }

    const picked = await vscode.window.showQuickPick(entryPoints, {
        placeHolder: vscode.l10n.t('Select a file-based C# app to convert to a project'),
        matchOnDescription: true,
        matchOnDetail: true,
    });

    // If user clicks away, cancelling operation
    if (!picked?.detail) {
        return;
    }

    await runConvertCommand(picked.detail);
}

/**
 * Returns `true` when `filePath` resides inside the directory cone of at least one
 * `.csproj` file -- i.e. when any directory in `csprojDirs` is an ancestor of (or the
 * same directory as) the file's parent directory.
 */
export function isInProjectCone(filePath: string, csprojDirs: Set<string>): boolean {
    let dir = path.dirname(filePath);
    let parent = path.dirname(dir);
    while (parent !== dir) {
        if (csprojDirs.has(dir)) {
            return true;
        }
        dir = parent;
        parent = path.dirname(dir);
    }
    // Check the final (root) directory.
    return csprojDirs.has(dir);
}

/**
 * Returns `true` when the file should be shown as a "Convert to Project" option.
 *
 * C# files outside all `.csproj` cones are always shown. C# files inside a `.csproj` cone are
 * shown only when they contain top-of-file file-based app markers (`#!` or `#:`).
 */
export function shouldShowConvertToProjectOption(
    filePath: string,
    kind: FileBasedAppKind,
    csprojDirs: Set<string>
): boolean {
    if (!isInProjectCone(filePath, csprojDirs)) {
        return true;
    }

    return kind === FileBasedAppKind.Shebang || kind === FileBasedAppKind.Directives;
}

/**
 * Runs `dotnet project convert <fileName>` in a new integrated terminal whose working
 * directory is set to the folder that contains the file.  A fresh terminal is always
 * created so that no shell-specific `cd` command is needed -- the `cwd` option handles
 * the working directory in a way that works on Bash, PowerShell, and CMD alike.
 */
async function runConvertCommand(filePath: string): Promise<void> {
    const workingDir = path.dirname(filePath);
    const fileName = path.basename(filePath);

    const terminal = vscode.window.createTerminal({
        name: vscode.l10n.t('dotnet project convert'),
        cwd: workingDir,
    });

    terminal.show(/*preserveFocus:*/ true);
    terminal.sendText(`dotnet project convert "${fileName}"`);
}

export enum FileBasedAppKind {
    /** The file does not include `#!` or `#:` directives. */
    None,
    /** The file starts with `#!`, making it a discoverable entry point. */
    Shebang,
    /** The file contains `#:` directives (package/sdk/property), strongly suggesting it is an entry point. */
    Directives,
}

/**
 * Detects whether `filePath` looks like an FBA entry point by scanning the first few lines
 * for `#!` or `#:` markers.  Mirrors Roslyn's `FileBasedProgramsEntryPointDiscovery`.
 *
 * Supply `readFileHead` to override the default `fs`-based reader (e.g. in tests).
 */
export function detectFileBasedAppKind(
    filePath: string,
    readFileHead: (p: string) => string | null = defaultReadFileHead
): FileBasedAppKind {
    const content = readFileHead(filePath);
    if (content === null) {
        return FileBasedAppKind.None;
    }

    // Strip an optional UTF-8 BOM before checking for `#!`.
    const stripped = content.startsWith('\uFEFF') ? content.slice(1) : content;

    if (stripped.startsWith('#!')) {
        return FileBasedAppKind.Shebang;
    }

    // Check the first few non-empty lines for `#:` directives.
    const lines = stripped.split(/\r?\n/);
    let checkedLines = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) {
            continue;
        }
        if (trimmed.startsWith('#:')) {
            return FileBasedAppKind.Directives;
        }
        // After encountering a line that is neither blank nor a directive, stop scanning.
        // Real entry points put their directives at the very top.
        if (++checkedLines >= 5) {
            break;
        }
    }

    return FileBasedAppKind.None;
}

/**
 * Default implementation of the `readFileHead` parameter for `detectFileBasedAppKind`.
 * Reads the first 4 KB of the file -- sufficient to find `#!` / `#:` near the top
 * without loading potentially large source files.
 */
function defaultReadFileHead(filePath: string): string | null {
    try {
        const buffer = Buffer.alloc(4096);
        const fd = fs.openSync(filePath, 'r');
        const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
        fs.closeSync(fd);
        return buffer.subarray(0, bytesRead).toString('utf8');
    } catch {
        // Ignore unreadable files.
        return null;
    }
}
