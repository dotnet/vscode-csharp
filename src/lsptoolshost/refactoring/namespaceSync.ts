/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { getCsprojFiles, getCsFiles, getRootNamespace } from './csprojAnalyzer';
import { calculateNamespace, extractCurrentNamespace } from './namespaceCalculator';

interface NamespaceChange {
    fileUri: vscode.Uri;
    currentNamespace: string;
    expectedNamespace: string;
    projectPath: string;
    isFileScoped: boolean;
}

/**
 * Main command to synchronize C# namespaces with directory structure.
 * Scans all .csproj files in the workspace and updates namespace declarations
 * in .cs files to match their folder structure.
 */
export async function syncNamespaces(outputChannel: vscode.LogOutputChannel): Promise<void> {
    await syncNamespacesInternal(outputChannel);
}

/**
 * Internal function to synchronize C# namespaces with directory structure.
 * @param outputChannel The output channel for logging
 */
async function syncNamespacesInternal(outputChannel: vscode.LogOutputChannel): Promise<void> {
    outputChannel.appendLine(`Starting namespace synchronization...`);
    outputChannel.show(true);

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('No workspace folder is open.');
        return;
    }

    // Find all .csproj files in the workspace
    const csprojFiles: vscode.Uri[] = [];
    for (const folder of workspaceFolders) {
        try {
            const projects = await getCsprojFiles(folder.uri);
            csprojFiles.push(...projects);
        } catch (err) {
            outputChannel.appendLine(`Failed to scan workspace folder ${folder.name}: ${String(err)}`);
        }
    }

    if (csprojFiles.length === 0) {
        vscode.window.showInformationMessage('No .csproj files found in workspace.');
        outputChannel.appendLine('No .csproj files found. Operation cancelled.');
        return;
    }

    outputChannel.appendLine(`Found ${csprojFiles.length} project(s).`);

    // Collect all potential changes
    const changes = await collectNamespaceChanges(csprojFiles, outputChannel);

    if (changes.length === 0) {
        vscode.window.showInformationMessage('All namespaces are already synchronized with their directory structure.');
        outputChannel.appendLine('No changes needed. All namespaces are correct.');
        return;
    }

    // Prompt user for action
    const action = await vscode.window.showInformationMessage(
        `Found ${changes.length} file(s) with namespace mismatches. What would you like to do?`,
        'Apply Changes',
        'Preview Only',
        'Cancel'
    );

    if (action === 'Apply Changes') {
        await applyNamespaceChanges(changes, outputChannel);
    } else if (action === 'Preview Only') {
        await showDryRunPreview(changes, outputChannel);
    } else {
        outputChannel.appendLine('Operation cancelled by user.');
    }
}

/**
 * Scans all C# files in the given projects and collects namespace mismatches.
 */
async function collectNamespaceChanges(
    csprojFiles: vscode.Uri[],
    outputChannel: vscode.LogOutputChannel
): Promise<NamespaceChange[]> {
    const changes: NamespaceChange[] = [];
    let totalChecked = 0;

    for (const csprojUri of csprojFiles) {
        outputChannel.appendLine(`Processing project: ${csprojUri.fsPath}`);

        try {
            const rootNamespace = await getRootNamespace(csprojUri);
            // Use path.dirname to get the project directory (works on both Windows and Unix)
            const projectDir = vscode.Uri.file(path.dirname(csprojUri.fsPath));
            const csFiles = await getCsFiles(projectDir);

            outputChannel.appendLine(`  Root namespace: ${rootNamespace}`);
            outputChannel.appendLine(`  Found ${csFiles.length} C# file(s)`);

            for (const fileUri of csFiles) {
                totalChecked++;

                try {
                    const content = await vscode.workspace.fs.readFile(fileUri);
                    const text = Buffer.from(content).toString('utf8');

                    const namespaceInfo = extractCurrentNamespace(text);
                    if (!namespaceInfo) {
                        outputChannel.appendLine(`  - No namespace declaration in ${fileUri.fsPath}; skipping.`);
                        continue;
                    }

                    const expectedNamespace = calculateNamespace(rootNamespace, csprojUri, fileUri);

                    if (namespaceInfo.namespace !== expectedNamespace) {
                        changes.push({
                            fileUri,
                            currentNamespace: namespaceInfo.namespace,
                            expectedNamespace,
                            projectPath: csprojUri.fsPath,
                            isFileScoped: namespaceInfo.isFileScoped,
                        });

                        outputChannel.appendLine(
                            `  - Found mismatch: ${fileUri.fsPath}\n    Current: ${namespaceInfo.namespace}\n    Expected: ${expectedNamespace}`
                        );
                    }
                } catch (err) {
                    outputChannel.appendLine(`  - Error processing ${fileUri.fsPath}: ${String(err)}`);
                }
            }
        } catch (err) {
            outputChannel.appendLine(`  Error processing project ${csprojUri.fsPath}: ${String(err)}`);
        }
    }

    outputChannel.appendLine(
        `\nScan complete: ${changes.length} file(s) need updating out of ${totalChecked} checked.`
    );
    return changes;
}

/**
 * Shows a dry-run preview of namespace changes without applying them.
 */
async function showDryRunPreview(changes: NamespaceChange[], outputChannel: vscode.LogOutputChannel): Promise<void> {
    outputChannel.appendLine('\n========== DRY RUN PREVIEW ==========');
    outputChannel.appendLine(`Would change ${changes.length} file(s):\n`);

    // Group changes by project
    const changesByProject = new Map<string, NamespaceChange[]>();
    for (const change of changes) {
        const existing = changesByProject.get(change.projectPath) || [];
        existing.push(change);
        changesByProject.set(change.projectPath, existing);
    }

    // Display changes grouped by project
    for (const [projectPath, projectChanges] of changesByProject) {
        outputChannel.appendLine(`\nProject: ${projectPath}`);
        outputChannel.appendLine(`  Changes: ${projectChanges.length} file(s)`);

        for (const change of projectChanges) {
            const relativePath = path.relative(path.dirname(change.projectPath), change.fileUri.fsPath);
            outputChannel.appendLine(`\n  File: ${relativePath}`);
            outputChannel.appendLine(`    Current:  ${change.currentNamespace}`);
            outputChannel.appendLine(`    Expected: ${change.expectedNamespace}`);
            outputChannel.appendLine(`    Type: ${change.isFileScoped ? 'File-scoped' : 'Block-scoped'}`);
        }
    }

    outputChannel.appendLine('\n========== END OF PREVIEW ==========');
    outputChannel.appendLine('\nNo changes were applied. Run "Sync Namespaces" to apply these changes.');

    vscode.window
        .showInformationMessage(
            `Dry run complete: ${changes.length} file(s) would be changed. Check output for details.`,
            'Show Output'
        )
        .then((selection: string | undefined) => {
            if (selection === 'Show Output') {
                outputChannel.show();
            }
        });
}

/**
 * Applies namespace changes using VS Code's WorkspaceEdit with preview.
 */
async function applyNamespaceChanges(
    changes: NamespaceChange[],
    outputChannel: vscode.LogOutputChannel
): Promise<void> {
    // Create WorkspaceEdit with all changes
    const edit = new vscode.WorkspaceEdit();

    for (const change of changes) {
        try {
            const document = await vscode.workspace.openTextDocument(change.fileUri);
            const text = document.getText();
            const namespaceInfo = extractCurrentNamespace(text);

            if (!namespaceInfo) {
                continue;
            }

            // Find the exact range of the namespace name to replace
            const startPos = document.positionAt(
                namespaceInfo.match.index! + namespaceInfo.match[0].lastIndexOf(namespaceInfo.namespace)
            );
            const endPos = document.positionAt(
                namespaceInfo.match.index! +
                    namespaceInfo.match[0].lastIndexOf(namespaceInfo.namespace) +
                    namespaceInfo.namespace.length
            );
            const range = new vscode.Range(startPos, endPos);

            // Add the text edit
            edit.replace(change.fileUri, range, change.expectedNamespace);
        } catch (err) {
            outputChannel.appendLine(`Error preparing edit for ${change.fileUri.fsPath}: ${String(err)}`);
        }
    }

    // Apply the edit with preview
    const applied = await vscode.workspace.applyEdit(edit);

    if (applied) {
        outputChannel.appendLine(`\nSuccessfully updated ${changes.length} file(s).`);
        outputChannel.appendLine('\nSummary of changes:');
        for (const change of changes) {
            outputChannel.appendLine(`  - ${change.fileUri.fsPath}`);
            outputChannel.appendLine(`    ${change.currentNamespace} → ${change.expectedNamespace}`);
        }

        vscode.window
            .showInformationMessage(`Namespace sync complete: ${changes.length} file(s) updated.`, 'Show Details')
            .then((selection: string | undefined) => {
                if (selection === 'Show Details') {
                    outputChannel.show();
                }
            });
    } else {
        outputChannel.appendLine('\nWorkspace edit was not applied (user may have cancelled preview).');
        vscode.window.showWarningMessage('Namespace sync was cancelled or failed to apply.');
    }
}
