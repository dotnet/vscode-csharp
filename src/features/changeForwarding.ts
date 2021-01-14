/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri, workspace } from 'vscode';
import { OmniSharpServer } from '../omnisharp/server';
import * as serverUtils from '../omnisharp/utils';
import { FileChangeType, LinePositionSpanTextChange } from '../omnisharp/protocol';
import { IDisposable } from '../Disposable';
import CompositeDisposable from '../CompositeDisposable';

function forwardDocumentChanges(server: OmniSharpServer): IDisposable {

    return workspace.onDidChangeTextDocument(event => {

        let { document, contentChanges } = event;
        if (document.isUntitled || document.languageId !== 'csharp' || document.uri.scheme !== 'file') {
            return;
        }

        if (contentChanges.length === 0) {
            // This callback fires with no changes when a document's state changes between "clean" and "dirty".
            return;
        }

        if (!server.isRunning()) {
            return;
        }

        const lineChanges = contentChanges.map(function (change): LinePositionSpanTextChange {
            const range = change.range;
            return {
                NewText: change.text,
                StartLine: range.start.line,
                StartColumn: range.start.character,
                EndLine: range.end.line,
                EndColumn: range.end.character
            };
        });

        serverUtils.updateBuffer(server, { Changes: lineChanges, FileName: document.fileName, ApplyChangesTogether: true }).catch(err => {
            console.error(err);
            return err;
        });
    });
}

function forwardFileChanges(server: OmniSharpServer): IDisposable {

    function onFileSystemEvent(changeType: FileChangeType): (uri: Uri) => void {
        return function (uri: Uri) {
            if (!server.isRunning()) {
                return;
            }

            if (changeType === FileChangeType.Change) {
                const docs = workspace.textDocuments.filter(doc => doc.uri.fsPath === uri.fsPath && isCSharpCodeFile(doc.uri));
                if (Array.isArray(docs) && docs.some(doc => !doc.isClosed)) {
                    // When a file changes on disk a FileSystemEvent is generated as well as a
                    // DidChangeTextDocumentEvent.The ordering of these is:
                    //  1. This method is called back. vscode's TextDocument has not yet been reloaded, so it has
                    //     the version from before the changes are applied.
                    //  2. vscode reloads the file, and fires onDidChangeTextDocument. The document has been updated,
                    //     and the changes have the delta.
                    // If we send this change to the server, then it will reload from the disk, which means it will
                    // be synchronized to the version after the changes. Then, onDidChangeTextDocument will fire and
                    // send the delta changes, which will cause the server to apply those exact changes. The results
                    // being that the file is now in an inconsistent state.
                    // If the document is closed, however, it will no longer be synchronized, so the text change will
                    // not be triggered and we should tell the server to reread from the disk.
                    // This applies to C# code files only, not other files significant for OmniSharp
                    // e.g. csproj or editorconfig files
                    return;
                }
            }

            const req = { FileName: uri.fsPath, changeType };

            serverUtils.filesChanged(server, [req]).catch(err => {
                console.warn(`[o] failed to forward file change event for ${uri.fsPath}`, err);
                return err;
            });
        };
    }

    function isCSharpCodeFile(uri: Uri) : Boolean {
        const normalized = uri.path.toLocaleLowerCase();
        return normalized.endsWith(".cs") || normalized.endsWith(".csx") || normalized.endsWith(".cake");
    }

    function onFolderEvent(changeType: FileChangeType): (uri: Uri) => void {
        return async function (uri: Uri) {
            if (!server.isRunning()) {
                return;
            }

            if (changeType === FileChangeType.Delete) {
                const requests = [{ FileName: uri.fsPath, changeType: FileChangeType.DirectoryDelete }];

                serverUtils.filesChanged(server, requests).catch(err => {
                    console.warn(`[o] failed to forward file change event for ${uri.fsPath}`, err);
                    return err;
                });
            }
        };
    }

    const watcher = workspace.createFileSystemWatcher('**/*.*');
    let d1 = watcher.onDidCreate(onFileSystemEvent(FileChangeType.Create));
    let d2 = watcher.onDidDelete(onFileSystemEvent(FileChangeType.Delete));
    let d3 = watcher.onDidChange(onFileSystemEvent(FileChangeType.Change));

    const watcherForFolders = workspace.createFileSystemWatcher('**/');
    let d4 = watcherForFolders.onDidDelete(onFolderEvent(FileChangeType.Delete));

    return new CompositeDisposable(watcher, d1, d2, d3, watcherForFolders, d4);
}

export default function forwardChanges(server: OmniSharpServer): IDisposable {

    // combine file watching and text document watching
    return new CompositeDisposable(
        forwardDocumentChanges(server),
        forwardFileChanges(server));
}
