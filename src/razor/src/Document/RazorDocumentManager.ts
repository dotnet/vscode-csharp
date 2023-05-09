/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import {
    DidChangeTextDocumentParams,
    Position,
    Range,
    TextDocumentContentChangeEvent,
    VersionedTextDocumentIdentifier
} from 'vscode-languageclient/node';
import { RoslynLanguageServer } from '../../../lsptoolshost/roslynLanguageServer';
import { CSharpProjectedDocument } from '../CSharp/CSharpProjectedDocument';
import { HtmlProjectedDocument } from '../Html/HtmlProjectedDocument';
import { RazorLanguage } from '../RazorLanguage';
import { RazorLanguageServerClient } from '../RazorLanguageServerClient';
import { RazorLogger } from '../RazorLogger';
import { ServerTextSpan } from '../RPC/ServerTextSpan';
import { UpdateBufferRequest } from '../RPC/UpdateBufferRequest';
import { getUriPath } from '../UriPaths';
import { IRazorDocument } from './IRazorDocument';
import { IRazorDocumentChangeEvent } from './IRazorDocumentChangeEvent';
import { IRazorDocumentManager } from './IRazorDocumentManager';
import { RazorDocumentChangeKind } from './RazorDocumentChangeKind';
import { createDocument } from './RazorDocumentFactory';
import { UriConverter } from '../../../lsptoolshost/uriConverter';

export class RazorDocumentManager implements IRazorDocumentManager {
    public roslynActivated = false;
    public razorDocumentGenerationInitialized = false;

    private readonly razorDocuments: { [hostDocumentPath: string]: IRazorDocument } = {};
    private readonly openRazorDocuments = new Set<string>();
    private pendingDidChangeNotifications = new Array<DidChangeTextDocumentParams>();
    private onChangeEmitter = new vscode.EventEmitter<IRazorDocumentChangeEvent>();

    constructor(
        private readonly serverClient: RazorLanguageServerClient,
        private readonly logger: RazorLogger) {
    }

    public get onChange() { return this.onChangeEmitter.event; }

    public get getPendingChangeNotifications() {
        return this.pendingDidChangeNotifications;
    }

    public get documents() {
        return Object.values(this.razorDocuments);
    }

    public async clearPendingDidChangeNotifications() {
        this.pendingDidChangeNotifications = [];
    }

    public async getDocument(uri: vscode.Uri) {
        const document = this._getDocument(uri);

        return document;
    }

    public async getActiveDocument() {
        if (!vscode.window.activeTextEditor) {
            return null;
        }

        if (vscode.window.activeTextEditor.document.languageId !== RazorLanguage.id) {
            return null;
        }

        const activeDocument = await this.getDocument(vscode.window.activeTextEditor.document.uri);
        return activeDocument;
    }

    // Returns true if a textDocument/didOpen notification has been sent
    // to the C# workspace for a given document and if the document is
    // currently open.
    public isRazorDocumentOpenInCSharpWorkspace(razorUri: vscode.Uri) {
        const path = getUriPath(razorUri);
        return this.openRazorDocuments.has(path);
    }

    // Indicates that a given document has been opened in the C# workspace.
    public didOpenRazorCSharpDocument(razorUri: vscode.Uri) {
        const path = getUriPath(razorUri);
        this.openRazorDocuments.add(path);
    }

    // Indicates that a given document has been closed in the C# workspace.
    public didCloseRazorCSharpDocument(razorUri: vscode.Uri) {
        const path = getUriPath(razorUri);
        this.openRazorDocuments.delete(path);
    }

    public async initialize() {
        // Track current documents
        const documentUris = await vscode.workspace.findFiles(RazorLanguage.globbingPattern);

        for (const uri of documentUris) {
            this.addDocument(uri);
        }

        for (const textDocument of vscode.workspace.textDocuments) {
            if (textDocument.languageId !== RazorLanguage.id) {
                continue;
            }

            if (textDocument.isClosed) {
                continue;
            }

            await this.openDocument(textDocument.uri);
        }
    }

    public register() {
        // Track future documents
        const watcher = vscode.workspace.createFileSystemWatcher(RazorLanguage.globbingPattern);
        const didCreateRegistration = watcher.onDidCreate(
            async (uri: vscode.Uri) => this.addDocument(uri));
        const didDeleteRegistration = watcher.onDidDelete(
            async (uri: vscode.Uri) => this.removeDocument(uri));
        const didOpenRegistration = vscode.workspace.onDidOpenTextDocument(async document => {
            if (document.languageId !== RazorLanguage.id) {
                return;
            }

            await this.openDocument(document.uri);
        });
        const didCloseRegistration = vscode.workspace.onDidCloseTextDocument(document => {
            if (document.languageId !== RazorLanguage.id) {
                return;
            }

            this.closeDocument(document.uri);
        });
        this.serverClient.onNotification(
            'razor/updateCSharpBuffer',
            async updateBufferRequest => this.updateCSharpBuffer(updateBufferRequest));

        this.serverClient.onNotification(
            'razor/updateHtmlBuffer',
            async updateBufferRequest => this.updateHtmlBuffer(updateBufferRequest));

        return vscode.Disposable.from(
            watcher,
            didCreateRegistration,
            didDeleteRegistration,
            didOpenRegistration,
            didCloseRegistration);
    }

    private _getDocument(uri: vscode.Uri) {
        const path = getUriPath(uri);
        let document = this.razorDocuments[path];

        // This might happen in the case that a file is opened outside the workspace
        if (!document) {
            this.logger.logMessage(`File '${path}' didn't exist in the Razor document list. This is likely because it's from outside the workspace.`);
            document = this.addDocument(uri);
        }

        return document;
    }

    private async openDocument(uri: vscode.Uri) {
        // On first open of a Razor document, we kick off the generation of all razor documents so that
        // components are discovered correctly. If we do this early, when we initialize everything, we
        // just spend a lot of time generating documents and json files that might not be needed.
        // If we wait for each individual document to be opened by the user, then locally defined components
        // don't work, which is a poor experience. This is the compromise.
        if (!this.razorDocumentGenerationInitialized) {
            this.razorDocumentGenerationInitialized = true;
            vscode.commands.executeCommand(RoslynLanguageServer.razorInitializeCommand);
            for (const document of this.documents) {
                await this.ensureDocumentAndProjectedDocumentsOpen(document);
            }
        }

        const document = this._getDocument(uri);

        this.notifyDocumentChange(document, RazorDocumentChangeKind.opened);
    }

    private closeDocument(uri: vscode.Uri) {
        const document = this._getDocument(uri);

        const csharpDocument = document.csharpDocument;
        const csharpProjectedDocument = csharpDocument as CSharpProjectedDocument;
        const htmlDocument = document.htmlDocument;
        const htmlProjectedDocument = htmlDocument as HtmlProjectedDocument;

        // Reset the projected documents, VSCode resets all sync versions when a document closes.
        csharpProjectedDocument.reset();
        htmlProjectedDocument.reset();

        // Files outside of the workspace will return undefined from getWorkspaceFolder
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            // Out of workspace files should be removed once they're closed
            this.removeDocument(uri);
        }

        this.notifyDocumentChange(document, RazorDocumentChangeKind.closed);
    }

    private addDocument(uri: vscode.Uri) {
        const path = getUriPath(uri);
        let document = this.razorDocuments[path];
        if (document) {
            this.logger.logMessage(`Skipping document creation for '${path}' because it already exists.`);
            return document;
        }

        document = createDocument(uri);
        this.razorDocuments[document.path] = document;

        this.notifyDocumentChange(document, RazorDocumentChangeKind.added);

        return document;
    }

    private removeDocument(uri: vscode.Uri) {
        const document = this._getDocument(uri);
        delete this.razorDocuments[document.path];

        this.notifyDocumentChange(document, RazorDocumentChangeKind.removed);
    }

    private async updateCSharpBuffer(updateBufferRequest: UpdateBufferRequest) {
        if (this.logger.verboseEnabled) {
            this.logger.logVerbose(
                `Updating the C# document for Razor file '${updateBufferRequest.hostDocumentFilePath}' ` +
                `(${updateBufferRequest.hostDocumentVersion})`);
        }

        const hostDocumentUri = vscode.Uri.file(updateBufferRequest.hostDocumentFilePath);
        const document = this._getDocument(hostDocumentUri);
        const projectedDocument = document.csharpDocument;

        if (!projectedDocument.hostDocumentSyncVersion ||
            projectedDocument.hostDocumentSyncVersion <= updateBufferRequest.hostDocumentVersion) {
            // We allow re-setting of the updated content from the same doc sync version in the case
            // of project or file import changes.
            const csharpProjectedDocument = projectedDocument as CSharpProjectedDocument;
            csharpProjectedDocument.update(updateBufferRequest.changes, updateBufferRequest.hostDocumentVersion);

            // Create change events for our didChange notifications
            const contentChangeEvents = new Array<TextDocumentContentChangeEvent>();
            for (const change of updateBufferRequest.changes) {
                const range = RazorDocumentManager.spanToRange(csharpProjectedDocument.getContent(), change.span, this.logger);
                const contentChangeEvent: TextDocumentContentChangeEvent = {
                    range: range,
                    text: change.newText
                };

                contentChangeEvents.push(contentChangeEvent);
            }

            // Send didChange notification to Roslyn
            const csharpPathWithScheme = UriConverter.serialize(csharpProjectedDocument.uri);
            const csharpTextDocumentIdentifier = VersionedTextDocumentIdentifier.create(csharpPathWithScheme, csharpProjectedDocument.projectedDocumentSyncVersion);
            const didChangeNotification: DidChangeTextDocumentParams = {
                textDocument: csharpTextDocumentIdentifier,
                contentChanges: contentChangeEvents
            };

            // Since the Razor language server starts before Roslyn's, there's a chance they haven't sent us a dynamic
            // file info request yet. If they haven't, we'll execute the didChange notifications later.
            if (!this.roslynActivated) {
                this.pendingDidChangeNotifications.push(didChangeNotification);
            } else {
                // If project information was already cached in a .json file, its possible the Razor server sent us C# content
                // before we've finished advising Roslyn of all of the files, so make sure we do it here just in case, because we're
                // about to send a didChange for it and we don't want that to error.
                if (!this.isRazorDocumentOpenInCSharpWorkspace(document.uri)) {
                    await vscode.workspace.openTextDocument(document.csharpDocument.uri);
                }

                vscode.commands.executeCommand(RoslynLanguageServer.roslynDidChangeCommand, didChangeNotification);
            }

            this.notifyDocumentChange(document, RazorDocumentChangeKind.csharpChanged);
        } else {
            this.logger.logWarning('Failed to update the C# document buffer. This is unexpected and may result in incorrect C# interactions.');
        }
    }

    private async updateHtmlBuffer(updateBufferRequest: UpdateBufferRequest) {
        if (this.logger.verboseEnabled) {
            this.logger.logVerbose(
                `Updating the HTML document for Razor file '${updateBufferRequest.hostDocumentFilePath}' ` +
                `(${updateBufferRequest.hostDocumentVersion})`);
        }

        const hostDocumentUri = vscode.Uri.file(updateBufferRequest.hostDocumentFilePath);
        const document = this._getDocument(hostDocumentUri);
        const projectedDocument = document.htmlDocument;

        if (!projectedDocument.hostDocumentSyncVersion ||
            projectedDocument.hostDocumentSyncVersion <= updateBufferRequest.hostDocumentVersion) {
            // We allow re-setting of the updated content from the same doc sync version in the case
            // of project or file import changes.
            const htmlProjectedDocument = projectedDocument as HtmlProjectedDocument;
            htmlProjectedDocument.update(updateBufferRequest.changes, updateBufferRequest.hostDocumentVersion);

            this.notifyDocumentChange(document, RazorDocumentChangeKind.htmlChanged);
        } else {
            this.logger.logWarning('Failed to update the HTML document buffer. This is unexpected and may result in incorrect HTML interactions.');
        }
    }

    private notifyDocumentChange(document: IRazorDocument, kind: RazorDocumentChangeKind) {
        if (this.logger.verboseEnabled) {
            this.logger.logVerbose(
                `Notifying document '${getUriPath(document.uri)}' changed '${RazorDocumentChangeKind[kind]}'`);
        }

        const args: IRazorDocumentChangeEvent = {
            document,
            kind,
        };

        this.onChangeEmitter.fire(args);
    }

    private async ensureDocumentAndProjectedDocumentsOpen(document: IRazorDocument) {
        // vscode.workspace.openTextDocument may send a textDocument/didOpen
        // request to the C# language server. We need to keep track of
        // this to make sure we don't send a duplicate request later on.
        const razorUri = vscode.Uri.parse('file:' + document.path, true);
        if (!this.isRazorDocumentOpenInCSharpWorkspace(razorUri)) {
            this.didOpenRazorCSharpDocument(razorUri);

            // Need to tell the Razor server that the document is open, or it won't generate C# code
            // for it, and our projected document will always be empty, until the user manually
            // opens the razor file.
            await vscode.workspace.openTextDocument(razorUri);
        }

        await vscode.workspace.openTextDocument(document.csharpDocument.uri);
        await vscode.workspace.openTextDocument(document.htmlDocument.uri);
    }

    private static spanToRange(sourceText: string, textSpan: ServerTextSpan, logger: RazorLogger) {
        let lineIndex = 0;
        let characterIndex = 0;

        let startPosition: Position | undefined = undefined;
        let endPosition: Position | undefined = undefined;

        for (let index = 0; index < sourceText.length; index++) {
            // If we hit a line break, skip over it and incremement the line count, taking into account '\r\n' vs. '\n' line endings
            if (sourceText[index] == '\n') {
                lineIndex++;
                characterIndex = 0;
                index++;
            } else if (index + 1 < sourceText.length && sourceText[index] == '\r' && sourceText[index + 1] == '\n') {
                lineIndex++;
                characterIndex = 0;

                // Start position - it's possible the span might begin between '\r' and '\n'
                if (startPosition == undefined && index + 1 == textSpan.start) {
                    startPosition = Position.create(lineIndex, characterIndex);
                }

                index += 2;
            }

            // Start position
            if (startPosition == undefined && index == textSpan.start) {
                startPosition = Position.create(lineIndex, characterIndex);
            }

            // End position
            if (index >= textSpan.start + textSpan.length) {
                endPosition = Position.create(lineIndex, characterIndex);
                return Range.create(startPosition as Position, endPosition);
            }

            characterIndex++;
        }

        // If we have a start position and no end position, return the length of the document.
        if (startPosition != undefined) {
            endPosition = Position.create(lineIndex, characterIndex);
            return Range.create(startPosition as Position, endPosition);
        }

        logger.logWarning(`Could not convert span to range for span ${textSpan}.`);
    }
}
