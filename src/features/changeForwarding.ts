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

        let { document } = event;
        if (document.isUntitled || document.languageId !== 'csharp' || document.uri.scheme !== 'file') {
            return;
        }

        if (!server.isRunning()) {
            return;
        }

        const lineChanges = event.contentChanges.map(function (change): LinePositionSpanTextChange {
            const range = change.range;
            return {
                NewText: change.text,
                StartLine: range.start.line + 1,
                StartColumn: range.start.character + 1,
                EndLine: range.end.line + 1,
                EndColumn: range.end.character + 1
            };
        });

        serverUtils.updateBuffer(server, { Changes: lineChanges, FileName: document.fileName }).catch(err => {
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

            let req = { FileName: uri.fsPath, changeType };

            serverUtils.filesChanged(server, [req]).catch(err => {
                console.warn(`[o] failed to forward file change event for ${uri.fsPath}`, err);
                return err;
            });
        };
    }

    function onFolderEvent(changeType: FileChangeType): (uri: Uri) => void {
        return async function (uri: Uri) {
            if (!server.isRunning()) {
                return;
            }

            if (changeType === FileChangeType.Delete) {
                let requests = [{ FileName: uri.fsPath, changeType: FileChangeType.DirectoryDelete }];

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
