/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export const convertToProjectCommandName = 'dotnet.convertToProject';

/**
 * Registers the command for converting a file-based C# app to a project-based app.
 *
 * This provides two entry points:
 * 1. Right-click on a .cs file → "Convert to Project" → runs `dotnet project convert <file>`
 * 2. Command palette → "Convert C# File-based App to Project" → quick pick of discoverable
 *    file-based apps in the workspace, then runs conversion on the selected file.
 *
 * Requires .NET 10 SDK or later (the `dotnet project convert` command was introduced in .NET 10).
 */
export function registerConvertToProjectCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(convertToProjectCommandName, async (uri?: vscode.Uri): Promise<void> => {
            if (uri !== undefined) {
                // Invoked from the right-click context menu with a specific file.
                await convertToProject(uri);
            } else {
                // Invoked from the command palette — let the user pick from discoverable apps.
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
    const filePath = uri.fsPath;

    if (!filePath.endsWith('.cs')) {
        vscode.window.showErrorMessage(vscode.l10n.t('Only C# (.cs) files can be converted to a project.'));
        return;
    }

    await runConvertCommand(filePath);
}

/**
 * Shows a quick-pick list of discoverable file-based C# apps in the workspace and
 * converts the one the user selects.
 *
 * A file is considered a discoverable file-based app entry point when it starts with
 * the `#!` shebang sequence (as required by the Roslyn automatic discovery algorithm).
 * Files with `#:` directives are also offered because they are classified as file-based
 * apps when opened in the editor even without `#!`.
 */
async function pickAndConvertToProject(): Promise<void> {
    const csFiles = await vscode.workspace.findFiles('**/*.cs', '**/obj/**');
    if (csFiles.length === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t('No C# files found in the workspace.'));
        return;
    }

    const entryPoints: vscode.QuickPickItem[] = [];

    for (const fileUri of csFiles) {
        const kind = detectFileBasedAppKind(fileUri.fsPath);
        if (kind !== FileBasedAppKind.None) {
            const label = path.basename(fileUri.fsPath);
            const description = vscode.workspace.asRelativePath(fileUri, true);
            entryPoints.push({ label, description, detail: fileUri.fsPath });
        }
    }

    if (entryPoints.length === 0) {
        vscode.window.showInformationMessage(
            vscode.l10n.t(
                'No file-based C# apps were found in the workspace. ' +
                    'A file-based app entry point must contain a `#!` or `#:` directive.'
            )
        );
        return;
    }

    const picked = await vscode.window.showQuickPick(entryPoints, {
        placeHolder: vscode.l10n.t('Select a file-based C# app to convert to a project'),
        matchOnDescription: true,
        matchOnDetail: true,
    });

    if (!picked?.detail) {
        return;
    }

    await runConvertCommand(picked.detail);
}

/**
 * Runs `dotnet project convert <filePath>` in an integrated terminal, targeting the
 * directory that contains the file so the SDK resolves paths correctly.
 */
async function runConvertCommand(filePath: string): Promise<void> {
    const workingDir = path.dirname(filePath);
    const fileName = path.basename(filePath);

    // Reuse an existing terminal if one with our name already exists to keep the UI tidy.
    const terminalName = vscode.l10n.t('dotnet project convert');
    const existing = vscode.window.terminals.find((t) => t.name === terminalName);
    const terminal =
        existing ??
        vscode.window.createTerminal({
            name: terminalName,
            cwd: workingDir,
        });

    terminal.show(/*preserveFocus:*/ true);

    // Change to the file's directory first in case the terminal was reused with a different cwd.
    if (existing) {
        const cdCommand = process.platform === 'win32' ? `cd /d "${workingDir}"` : `cd "${workingDir}"`;
        terminal.sendText(cdCommand);
    }

    terminal.sendText(`dotnet project convert "${fileName}"`);
}

const enum FileBasedAppKind {
    /** The file is not a file-based app entry point. */
    None,
    /** The file starts with `#!`, making it a discoverable entry point. */
    Shebang,
    /** The file contains `#:` directives (package/sdk/property), strongly suggesting it is an entry point. */
    Directives,
}

/**
 * Reads the beginning of a file on disk to determine whether it looks like a
 * file-based C# app entry point.  This intentionally mirrors the heuristics used
 * by the Roslyn `FileBasedProgramsEntryPointDiscovery` class.
 */
function detectFileBasedAppKind(filePath: string): FileBasedAppKind {
    try {
        // Read only the first 4 KB — sufficient to find `#!` / `#:` near the top without
        // loading potentially large source files.
        const buffer = Buffer.alloc(4096);
        const fd = fs.openSync(filePath, 'r');
        const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
        fs.closeSync(fd);

        const content = buffer.subarray(0, bytesRead).toString('utf8');

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
    } catch {
        // Ignore unreadable files.
    }

    return FileBasedAppKind.None;
}
