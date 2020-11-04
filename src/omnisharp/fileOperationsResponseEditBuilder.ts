/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { LanguageMiddlewareFeature } from './LanguageMiddlewareFeature';
import { FileModificationType, FileOperationResponse, ModifiedFileResponse, RenamedFileResponse } from "./protocol";
import { toRange2 } from './typeConversion';

export async function buildEditForResponse(changes: FileOperationResponse[], languageMiddlewareFeature: LanguageMiddlewareFeature, token: vscode.CancellationToken): Promise<boolean> {
    let edit = new vscode.WorkspaceEdit();

    let fileToOpen: Uri = null;

    if (!changes || !Array.isArray(changes) || !changes.length) {
        return true;
    }

    for (const change of changes) {
        if (change.ModificationType == FileModificationType.Opened) {
            // The CodeAction requested that we open a file.
            // Record that file name and keep processing CodeActions.
            // If a CodeAction requests that we open multiple files
            // we only open the last one (what would it mean to open multiple files?)
            fileToOpen = vscode.Uri.file(change.FileName);
        }

        if (change.ModificationType == FileModificationType.Modified) {
            const modifiedChange = <ModifiedFileResponse>change;
            const uri = vscode.Uri.file(modifiedChange.FileName);
            let edits: vscode.TextEdit[] = [];
            for (let textChange of modifiedChange.Changes) {
                edits.push(vscode.TextEdit.replace(toRange2(textChange), textChange.NewText));
            }

            edit.set(uri, edits);
        }
    }

    for (const change of changes) {
        if (change.ModificationType == FileModificationType.Renamed) {
            const renamedChange = <RenamedFileResponse>change;
            edit.renameFile(vscode.Uri.file(renamedChange.FileName), vscode.Uri.file(renamedChange.NewFileName));
        }
    }

    // Allow language middlewares to re-map its edits if necessary.
    edit = await languageMiddlewareFeature.remap("remapWorkspaceEdit", edit, token);

    const applyEditPromise = vscode.workspace.applyEdit(edit);

    // Unfortunately, the textEditor.Close() API has been deprecated
    // and replaced with a command that can only close the active editor.
    // If files were renamed that weren't the active editor, their tabs will
    // be left open and marked as "deleted" by VS Code
    return fileToOpen != null
        ? applyEditPromise.then(_ => {
            return vscode.commands.executeCommand("vscode.open", fileToOpen);
        })
        : applyEditPromise;
}
