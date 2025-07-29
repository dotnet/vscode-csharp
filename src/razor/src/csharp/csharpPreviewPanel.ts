﻿/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IRazorDocumentChangeEvent } from '../document/IRazorDocumentChangeEvent';
import { RazorDocumentChangeKind } from '../document/razorDocumentChangeKind';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { getUriPath } from '../uriPaths';
import { showErrorMessage, showInformationMessage } from '../../../shared/observers/utils/showMessage';

export class CSharpPreviewPanel {
    public static readonly viewType = 'razorCSharpPreview';

    private panel: vscode.WebviewPanel | undefined;
    private csharpContent: string | undefined;

    constructor(private readonly documentManager: RazorDocumentManager) {
        documentManager.onChange(async (event) => this.documentChanged(event));
    }

    public async show() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Two);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                CSharpPreviewPanel.viewType,
                vscode.l10n.t('Razor C# Preview'),
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    // Disallow any remote sources
                    localResourceRoots: [],
                }
            );
            this.attachToCurrentPanel();
        }

        await this.update();
    }

    public async revive(panel: vscode.WebviewPanel) {
        this.panel = panel;
        this.attachToCurrentPanel();
        await this.update();
    }

    private async documentChanged(event: IRazorDocumentChangeEvent) {
        if (!this.panel) {
            return;
        }

        if (
            event.kind === RazorDocumentChangeKind.csharpChanged ||
            event.kind === RazorDocumentChangeKind.opened ||
            event.kind === RazorDocumentChangeKind.closed
        ) {
            await this.update();
        }
    }

    private attachToCurrentPanel() {
        if (!this.panel) {
            showErrorMessage(vscode, vscode.l10n.t('Unexpected error when attaching to C# preview window.'));
            return;
        }

        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'copy':
                    if (!this.csharpContent) {
                        return;
                    }

                    await vscode.env.clipboard.writeText(this.csharpContent);
                    showInformationMessage(vscode, vscode.l10n.t('Razor C# copied to clipboard'));
                    return;
            }
        });
        this.panel.onDidDispose(() => (this.panel = undefined));
    }

    private async update() {
        if (!this.panel) {
            return;
        }
        const document = await this.documentManager.getActiveDocument();
        let hostDocumentFilePath = '';
        let virtualDocumentFilePath = '';

        if (document) {
            // The document is guaranteed to be a Razor document
            this.csharpContent = document.csharpDocument.getContent();
            hostDocumentFilePath = getUriPath(document.uri);
            virtualDocumentFilePath = getUriPath(document.csharpDocument.uri);
        } else {
            this.csharpContent = undefined;
        }

        let content = this.csharpContent ? this.csharpContent : '';
        content = content.replace(/</g, '&lt;').replace(/</g, '&gt;');

        const title = vscode.l10n.t('Report a Razor issue');
        const hostDocumentPathLabel = vscode.l10n.t('Host document file path');
        const virtualDocumentPathLabel = vscode.l10n.t('Virtual document file path');
        const copyCSharpLabel = vscode.l10n.t('Copy C#');
        this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        button {
            background-color: #eff3f6;
            background-image: linear-gradient(-180deg,#fafbfc,#eff3f6 90%);
            color: #24292e;
            border: 1px solid rgba(27,31,35,.2);
            border-radius: .25em;
            font-size: 1.1em;
            font-weight: 600;
            line-height: 18px;
            padding: 6px 12px;
            vertical-align: middle;
            cursor: pointer;
        }
        button:focus-visible {
            outline-color: var(--vscode-focusBorder)
        }
    </style>

    <script type="text/javascript">
        const vscode = acquireVsCodeApi();
        function copy() {
            vscode.postMessage({
                command: 'copy'
            });
        }
    </script>
</head>
<body>
    <p>${hostDocumentPathLabel}: <strong>${hostDocumentFilePath}</strong></p>
    <p>${virtualDocumentPathLabel}: <strong>${virtualDocumentFilePath}</strong></p
    <p><button onclick="copy()">${copyCSharpLabel}</button></p>
    <hr />
    <pre>${content}</pre>
</body>
</html>`;
    }
}
