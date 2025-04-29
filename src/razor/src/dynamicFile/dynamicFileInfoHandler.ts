/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { UriConverter } from '../../../lsptoolshost/utils/uriConverter';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { RazorLogger } from '../razorLogger';
import { ProvideDynamicFileParams } from './provideDynamicFileParams';
import { ProvideDynamicFileResponse } from './provideDynamicFileResponse';
import { RemoveDynamicFileParams } from './removeDynamicFileParams';
import { CSharpProjectedDocument } from '../csharp/csharpProjectedDocument';
import { RazorDocumentChangeKind } from '../document/razorDocumentChangeKind';
import { RazorDynamicFileChangedParams } from './dynamicFileUpdatedParams';
import { TextDocumentIdentifier } from 'vscode-languageserver-protocol';
import { razorTextChange } from './razorTextChange';
import { razorTextSpan } from './razorTextSpan';
import { razorOptions } from '../../../shared/options';

// Handles Razor generated doc communication between the Roslyn workspace and Razor.
// didChange behavior for Razor generated docs is handled in the RazorDocumentManager.
export class DynamicFileInfoHandler {
    public static readonly provideDynamicFileInfoCommand = 'razor.provideDynamicFileInfo';
    public static readonly removeDynamicFileInfoCommand = 'razor.removeDynamicFileInfo';
    public static readonly dynamicFileUpdatedCommand = 'razor.dynamicFileUpdated';

    constructor(private readonly documentManager: RazorDocumentManager, private readonly logger: RazorLogger) {}

    public register() {
        vscode.commands.registerCommand(
            DynamicFileInfoHandler.provideDynamicFileInfoCommand,
            async (request: ProvideDynamicFileParams) => {
                return this.provideDynamicFileInfo(request);
            }
        );
        vscode.commands.registerCommand(
            DynamicFileInfoHandler.removeDynamicFileInfoCommand,
            async (request: RemoveDynamicFileParams) => {
                await this.removeDynamicFileInfo(request);
            }
        );

        if (!razorOptions.cohostingEnabled) {
            this.documentManager.onChange(async (e) => {
                // Ignore any updates without text changes. This is important for perf since sending an update to roslyn does
                // a round trip for producing nothing new and causes a lot of churn in solution updates.
                if (e.kind == RazorDocumentChangeKind.csharpChanged && !e.document.isOpen && e.changes.length > 0) {
                    const uriString = UriConverter.serialize(e.document.uri);
                    const identifier = TextDocumentIdentifier.create(uriString);
                    await vscode.commands.executeCommand(
                        DynamicFileInfoHandler.dynamicFileUpdatedCommand,
                        new RazorDynamicFileChangedParams(identifier)
                    );
                }
            });
        }
    }

    // Given Razor document URIs, returns associated generated doc URIs
    private async provideDynamicFileInfo(
        request: ProvideDynamicFileParams
    ): Promise<ProvideDynamicFileResponse | null> {
        this.documentManager.roslynActivated = true;
        const vscodeUri = vscode.Uri.parse(request.razorDocument.uri, true);

        // Normally we start receiving dynamic info after Razor is initialized, but if the user had a .razor file open
        // when they started VS Code, the order is the other way around. This no-ops if Razor is already initialized.
        await this.documentManager.ensureRazorInitialized();

        const razorDocument = await this.documentManager.getDocument(vscodeUri);
        try {
            if (razorDocument === undefined) {
                this.logger.logWarning(
                    `Could not find Razor document ${vscodeUri.fsPath}; adding null as a placeholder in URI array.`
                );

                return null;
            }

            const csharpDocument = razorDocument.csharpDocument as CSharpProjectedDocument;
            if (request.fullText) {
                // The server asked for a full replace so the newtext is the important
                // thing here, the span doesn't matter.
                const change = new razorTextChange(razorDocument.csharpDocument.getContent(), new razorTextSpan(0, 0));

                return new ProvideDynamicFileResponse(
                    request.razorDocument,
                    [change],
                    csharpDocument.checksum,
                    csharpDocument.checksumAlgorithm,
                    csharpDocument.encodingCodePage
                );
            }

            const virtualCsharpUri = UriConverter.serialize(razorDocument.csharpDocument.uri);

            if (this.documentManager.isRazorDocumentOpenInCSharpWorkspace(vscodeUri)) {
                // Open documents have didOpen/didChange to update the csharp buffer. Razor
                // does not send edits and instead lets vscode handle them.
                return null;
            } else {
                // Closed documents provide edits since the last time they were requested since
                // there is no open buffer in vscode corresponding to the csharp content.
                const response = csharpDocument.applyEdits();
                const updates = response.edits?.flatMap((e) =>
                    e.changes.map((c) => new razorTextChange(c.newText, new razorTextSpan(c.span.start, c.span.length)))
                );

                return new ProvideDynamicFileResponse(
                    { uri: virtualCsharpUri },
                    updates ?? [],
                    response.originalChecksum,
                    response.originalChecksumAlgorithm,
                    response.originalEncodingCodePage
                );
            }
        } catch (error) {
            this.logger.logWarning(`${DynamicFileInfoHandler.provideDynamicFileInfoCommand} failed with ${error}`);
        }

        return null;
    }

    private async removeDynamicFileInfo(request: RemoveDynamicFileParams) {
        try {
            const vscodeUri = UriConverter.deserialize(request.csharpDocument.uri);
            if (this.documentManager.isRazorDocumentOpenInCSharpWorkspace(vscodeUri)) {
                this.documentManager.didCloseRazorCSharpDocument(vscodeUri);
            }
        } catch (error) {
            this.logger.logWarning(`${DynamicFileInfoHandler.removeDynamicFileInfoCommand} failed with ${error}`);
        }
    }
}
