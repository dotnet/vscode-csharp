/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { IEventEmitterFactory } from '../IEventEmitterFactory';
import { RazorLanguageServiceClient } from '../razorLanguageServiceClient';
import { RazorLogger } from '../razorLogger';
import { HtmlPreviewPanel } from './htmlPreviewPanel';
import { HtmlProjectedDocumentContentProvider } from './htmlProjectedDocumentContentProvider';
import { HtmlTagCompletionProvider } from './htmlTagCompletionProvider';

export class RazorHtmlFeature {
    public readonly projectionProvider: HtmlProjectedDocumentContentProvider;
    private readonly htmlTagCompletionProvider: HtmlTagCompletionProvider;
    private readonly htmlPreviewPanel: HtmlPreviewPanel;

    constructor(
        documentManager: RazorDocumentManager,
        serviceClient: RazorLanguageServiceClient,
        eventEmitterFactory: IEventEmitterFactory,
        logger: RazorLogger
    ) {
        this.projectionProvider = new HtmlProjectedDocumentContentProvider(
            documentManager,
            eventEmitterFactory,
            logger
        );
        this.htmlTagCompletionProvider = new HtmlTagCompletionProvider(documentManager, serviceClient);
        this.htmlPreviewPanel = new HtmlPreviewPanel(documentManager);
    }

    public register() {
        const registrations = [
            vscode.workspace.registerTextDocumentContentProvider(
                HtmlProjectedDocumentContentProvider.scheme,
                this.projectionProvider
            ),
            vscode.commands.registerCommand('extension.showRazorHtmlWindow', async () => this.htmlPreviewPanel.show()),
            this.htmlTagCompletionProvider.register(),
        ];

        if (vscode.window.registerWebviewPanelSerializer) {
            registrations.push(
                vscode.window.registerWebviewPanelSerializer(HtmlPreviewPanel.viewType, {
                    deserializeWebviewPanel: async (panel: vscode.WebviewPanel) => {
                        await this.htmlPreviewPanel.revive(panel);
                    },
                })
            );
        }

        return vscode.Disposable.from(...registrations);
    }
}
