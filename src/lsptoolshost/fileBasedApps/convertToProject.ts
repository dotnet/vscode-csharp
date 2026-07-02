/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export const convertToProjectCommandName = 'dotnet.convertToProject';
export const likelyFbaEntryPointsContextKey = 'dotnet.likelyFbaEntryPoints';

/**
 * Registers the `dotnet.convertToProject` command. When invoked with a URI (context menu)
 * it converts that file directly; without a URI (command palette) it shows a quick pick of
 * discoverable FBA entry points. Requires .NET 10 SDK or later.
 */
export function registerConvertToProjectCommands(context: vscode.ExtensionContext): void {
    const refreshMenuContext = async (): Promise<void> => refreshConvertToProjectMenuContext();

    context.subscriptions.push(
        vscode.commands.registerCommand(convertToProjectCommandName, async (uri?: vscode.Uri): Promise<void> => {
            if (uri !== undefined) {
                // Invoked from the right-click context menu with a specific file.
                await convertToProject(uri);
            } else {
                // Invoked from the command palette -- let the user pick from discoverable apps.
                await pickAndConvertToProject();
            }
        }),
        vscode.workspace.onDidOpenTextDocument((document) => {
            if (document.languageId === 'csharp' && path.extname(document.uri.fsPath) !== '.cs') {
                void refreshMenuContext();
            }
        }),
        vscode.workspace.onDidCloseTextDocument((document) => {
            if (document.languageId === 'csharp' && path.extname(document.uri.fsPath) !== '.cs') {
                void refreshMenuContext();
            }
        }),
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (document.languageId === 'csharp' || path.extname(document.uri.fsPath) === '.csproj') {
                void refreshMenuContext();
            }
        }),
        vscode.workspace.onDidCreateFiles((event) => {
            if (event.files.some((uri) => isConvertToProjectRefreshCandidate(uri))) {
                void refreshMenuContext();
            }
        }),
        vscode.workspace.onDidDeleteFiles((event) => {
            if (event.files.some((uri) => isConvertToProjectRefreshCandidate(uri))) {
                void refreshMenuContext();
            }
        }),
        vscode.workspace.onDidRenameFiles((event) => {
            if (
                event.files.some(
                    (file) =>
                        isConvertToProjectRefreshCandidate(file.oldUri) ||
                        isConvertToProjectRefreshCandidate(file.newUri)
                )
            ) {
                void refreshMenuContext();
            }
        })
    );

    void refreshMenuContext();
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

    const kind = detectTextDocumentFileBasedAppKind(document);
    if (!isLikelyFbaEntryPoint(uri.fsPath, kind, await getCsprojDirs())) {
        vscode.window.showInformationMessage(
            vscode.l10n.t('This file is not detected as a file-based app entry point.')
        );
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
    const allCsUris = await findCandidateCsUris();

    if (allCsUris.length === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t('No C# files found in the workspace.'));
        return;
    }

    const entryPoints: vscode.QuickPickItem[] = [];
    const csprojDirs = await getCsprojDirs();

    for (const fileUri of allCsUris) {
        const kind = detectFileBasedAppKindForUri(fileUri);
        const filePath = fileUri.fsPath;

        if (isLikelyFbaEntryPoint(filePath, kind, csprojDirs)) {
            const label = path.basename(filePath);
            const description = vscode.workspace.asRelativePath(fileUri, true);
            entryPoints.push({ label, description, detail: filePath });
        }
    }

    if (entryPoints.length === 0) {
        vscode.window.showInformationMessage(
            vscode.l10n.t(
                'No file-based C# apps were found in the workspace. A file-based app entry point must not be part of any `.csproj` project, unless it contains a top-of-file `#!` or `#:` directive.'
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

export async function refreshConvertToProjectMenuContext(): Promise<void> {
    const entryPoints = await findLikelyFbaEntryPointUris();
    const contextValue = Object.fromEntries(entryPoints.map((uri) => [uri.path, true]));
    await vscode.commands.executeCommand('setContext', likelyFbaEntryPointsContextKey, contextValue);
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
export function isLikelyFbaEntryPoint(filePath: string, kind: FileBasedAppKind, csprojDirs: Set<string>): boolean {
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
 */
export function detectFileBasedAppKind(filePath: string): FileBasedAppKind {
    return detectFileBasedAppKindFromContent(defaultReadFileHead(filePath));
}

function detectTextDocumentFileBasedAppKind(document: Pick<vscode.TextDocument, 'getText'>): FileBasedAppKind {
    return detectFileBasedAppKindFromContent(document.getText().slice(0, 1024));
}

function detectFileBasedAppKindForUri(uri: vscode.Uri): FileBasedAppKind {
    const openDocument = vscode.workspace.textDocuments.find((document) => document.uri.fsPath === uri.fsPath);
    return openDocument ? detectTextDocumentFileBasedAppKind(openDocument) : detectFileBasedAppKind(uri.fsPath);
}

function detectFileBasedAppKindFromContent(content: string | null): FileBasedAppKind {
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
    const nonEmptyLinesToCheck = 5;
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
        // Real FBA entry points must put their directives before other C# tokens,
        // though FBA directives can come after comments
        if (++checkedLines >= nonEmptyLinesToCheck) {
            break;
        }
    }

    return FileBasedAppKind.None;
}

async function findCandidateCsUris(): Promise<vscode.Uri[]> {
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

    return allCsUris;
}

async function findLikelyFbaEntryPointUris(): Promise<vscode.Uri[]> {
    const allCsUris = await findCandidateCsUris();
    const csprojDirs = await getCsprojDirs();

    return allCsUris.filter((fileUri) =>
        isLikelyFbaEntryPoint(fileUri.fsPath, detectFileBasedAppKindForUri(fileUri), csprojDirs)
    );
}

async function getCsprojDirs(): Promise<Set<string>> {
    // Build a set of directories that contain a .csproj so we can quickly check whether
    // a given .cs file lives inside a project cone.
    const csprojFiles = await vscode.workspace.findFiles('**/*.csproj');
    return new Set(csprojFiles.map((u) => path.dirname(u.fsPath)));
}

function isConvertToProjectRefreshCandidate(uri: vscode.Uri): boolean {
    const extension = path.extname(uri.fsPath);
    return extension === '.cs' || extension === '.csproj';
}

/**
 * Default implementation of the `readFileHead` parameter for `detectFileBasedAppKind`.
 * Reads the first 1 KB of the file -- sufficient to find `#!` / `#:` near the top
 * without loading potentially large source files.
 */
function defaultReadFileHead(filePath: string): string | null {
    try {
        const buffer = Buffer.alloc(1024);
        const fd = fs.openSync(filePath, 'r');
        const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
        fs.closeSync(fd);
        return buffer.subarray(0, bytesRead).toString('utf8');
    } catch {
        // Ignore unreadable files.
        return null;
    }
}
