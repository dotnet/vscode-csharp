﻿/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as os from 'os';
import * as vscodeAdapter from '../vscodeAdapter';
import * as vscode from 'vscode';
import { IRazorDocument } from '../document/IRazorDocument';
import { IRazorDocumentManager } from '../document/IRazorDocumentManager';
import { razorExtensionId } from '../razorExtensionId';
import { IReportIssueDataCollectionResult } from './IReportIssueDataCollectionResult';

export class ReportIssueCreator {
    constructor(
        private readonly vscodeApi: vscodeAdapter.api,
        private readonly documentManager: IRazorDocumentManager
    ) {}

    public async create(collectionResult: IReportIssueDataCollectionResult) {
        let razorContent: string;
        let csharpContent: string;
        let htmlContent: string;

        if (collectionResult.document) {
            razorContent = await this.getRazor(collectionResult.document);

            const razorDocument = await this.documentManager.getDocument(collectionResult.document.uri);
            csharpContent = await this.getProjectedCSharp(razorDocument);
            htmlContent = await this.getProjectedHtml(razorDocument);
        } else {
            razorContent = vscode.l10n.t('Non Razor file as active document');
            csharpContent = vscode.l10n.t('Could not determine CSharp content');
            htmlContent = vscode.l10n.t('Could not determine Html content');
        }

        const razorExtensionVersion = this.getExtensionVersion();
        let dotnetInfo = '';
        try {
            dotnetInfo = await this.getDotnetInfo();
        } catch (error: any) {
            dotnetInfo = vscode.l10n.t('A valid dotnet installation could not be found: {0}', error?.toString());
        }
        const extensionTable = this.generateExtensionTable();

        const sanitizedLogOutput = this.sanitize(collectionResult.logOutput);
        const sanitizedRazorContent = this.sanitize(razorContent);
        const sanitizedCSharpContent = this.sanitize(csharpContent);
        const sanitizedHtmlContent = this.sanitize(htmlContent);
        const sanitizedDotnetInfo = this.sanitize(dotnetInfo);

        const issueType = vscode.l10n.t('Is this a Bug or Feature request?');

        const defaultIssueType = vscode.l10n.t('Bug');

        const reproStepsHeader = vscode.l10n.t('Steps to reproduce');
        const genericPlaceholderContent = vscode.l10n.t('Please fill in this section');
        const problemDescriptionHeader = vscode.l10n.t('Description of the problem');
        const expectedBehaviorHeader = vscode.l10n.t('Expected behavior');
        const actualBehaviorHeader = vscode.l10n.t('Actual behavior');
        const logsHeader = vscode.l10n.t('Logs');

        const omniSharpHeader = vscode.l10n.t('OmniSharp');
        const omniSharpInstructions = vscode.l10n.t(
            "To find the OmniSharp log, open VS Code's" + ' "Output" pane, then in the dropdown choose "OmniSharp Log".'
        );
        const razorHeader = vscode.l10n.t('Razor');
        const expandText = vscode.l10n.t('Expand');

        const workspaceInfo = vscode.l10n.t('Workspace information');
        const razorDocument = vscode.l10n.t('Razor document');
        const projectedCSDocument = vscode.l10n.t('Projected CSharp document');
        const projectedHtmlDocument = vscode.l10n.t('Projected Html document');
        const machineInfo = vscode.l10n.t('Machine information');
        const razorVersion = vscode.l10n.t('Razor.VSCode version');
        const vscodeVersion = vscode.l10n.t('VSCode version');
        const extensionsLabel = vscode.l10n.t('Extensions');

        return `## ${issueType}:
${defaultIssueType}

## ${reproStepsHeader}:
------------------- ${genericPlaceholderContent} -------------------------

## ${problemDescriptionHeader}:
------------------- ${genericPlaceholderContent} -------------------------

${expectedBehaviorHeader}:

${actualBehaviorHeader}:

## ${logsHeader}

#### ${omniSharpHeader}
------------------- ${genericPlaceholderContent} -------------------------
${omniSharpInstructions}

#### ${razorHeader}
<details><summary>${expandText}</summary>
<p>

\`\`\`
${sanitizedLogOutput}
\`\`\`

</p>
</details>

## ${workspaceInfo}

#### ${razorDocument}:
<details><summary>${expandText}</summary>
<p>

\`\`\`Razor
${sanitizedRazorContent}
\`\`\`

</p>
</details>

#### ${projectedCSDocument}:
<details><summary>${expandText}</summary>
<p>

\`\`\`C#
${sanitizedCSharpContent}
\`\`\`

</p>
</details>

#### ${projectedHtmlDocument}:
<details><summary>${expandText}</summary>
<p>

\`\`\`Html
${sanitizedHtmlContent}
\`\`\`

</p>
</details>

## ${machineInfo}


**${vscodeVersion}**: ${this.vscodeApi.version}
**${razorVersion}**: ${razorExtensionVersion}
#### \`dotnet --info\`

<details><summary>${expandText}</summary>
<p>

\`\`\`
${sanitizedDotnetInfo}
\`\`\`

</p>
</details>

#### ${extensionsLabel}
<details><summary>${expandText}</summary>
<p>

${extensionTable}

</p>
</details>`;
    }

    // Protected for testing
    protected sanitize(content: string) {
        const user = process.env.USERNAME === undefined ? process.env.USER : process.env.USERNAME;

        if (user === undefined) {
            // Couldn't determine user, therefore can't truly sanitize the content.
            return content;
        }

        const replacer = new RegExp(user, 'g');
        const sanitizedContent = content.replace(replacer, 'anonymous');
        return sanitizedContent;
    }

    // Protected for testing
    protected async getRazor(document: vscodeAdapter.TextDocument) {
        const content = document.getText();

        return content;
    }

    // Protected for testing
    protected async getProjectedCSharp(razorDocument: IRazorDocument) {
        const projectedCSharpHeaderFooter = vscode.l10n.t('Projected CSharp as seen by extension');

        let csharpContent = `////////////////////// ${projectedCSharpHeaderFooter} ///////////////////////
${razorDocument.csharpDocument.getContent()}


////////////////////// ${projectedCSharpHeaderFooter} ///////////////////////`;

        const errorSuffix = vscode.l10n.t("Unable to resolve VSCode's version of CSharp");
        try {
            const csharpTextDocument = await this.vscodeApi.workspace.openTextDocument(
                razorDocument.csharpDocument.uri
            );
            if (csharpTextDocument) {
                csharpContent = `${csharpContent}
${csharpTextDocument.getText()}`;
            } else {
                csharpContent = `${csharpContent}
${errorSuffix}`;
            }
        } catch (_) {
            csharpContent = `${csharpContent}
${errorSuffix}`;
        }

        return csharpContent;
    }

    // Protected for testing
    protected async getProjectedHtml(razorDocument: IRazorDocument) {
        const projectedHTmlHeaderFooter = vscode.l10n.t('Projected Html as seen by extension');
        let htmlContent = `////////////////////// ${projectedHTmlHeaderFooter} ///////////////////////
${razorDocument.htmlDocument.getContent()}


////////////////////// ${projectedHTmlHeaderFooter} ///////////////////////`;

        const errorSuffix = vscode.l10n.t("Unable to resolve VSCode's version of Html");
        try {
            const htmlTextDocument = await this.vscodeApi.workspace.openTextDocument(razorDocument.htmlDocument.uri);
            if (htmlTextDocument) {
                htmlContent = `${htmlContent}
${htmlTextDocument.getText()}`;
            } else {
                htmlContent = `${htmlContent}
${errorSuffix}`;
            }
        } catch (_) {
            htmlContent = `${htmlContent}
${errorSuffix}`;
        }

        return htmlContent;
    }

    // Protected for testing
    protected getExtensionVersion(): string {
        const extension = this.vscodeApi.extensions.getExtension(razorExtensionId);
        if (!extension) {
            return vscode.l10n.t('Unable to find Razor extension version.');
        }
        return extension.packageJSON.version;
    }

    // Protected for testing
    protected getInstalledExtensions() {
        const extensions: Array<vscodeAdapter.Extension<any>> = this.vscodeApi.extensions.all.filter(
            (extension) => extension.packageJSON.isBuiltin === false
        );

        return extensions.sort((a, b) =>
            a.packageJSON.name.toLowerCase().localeCompare(b.packageJSON.name.toLowerCase())
        );
    }

    // Protected for testing
    protected generateExtensionTable() {
        const extensions = this.getInstalledExtensions();
        if (extensions.length <= 0) {
            return 'none';
        }

        const extensionLabel = vscode.l10n.t('Extension');
        const authorLabel = vscode.l10n.t('Author');
        const versionLabel = vscode.l10n.t('Version');
        const tableHeader = `|${extensionLabel}|${authorLabel}|${versionLabel}|${os.EOL}|---|---|---|`;
        const table = extensions
            .map((e) => `|${e.packageJSON.name}|${e.packageJSON.publisher}|${e.packageJSON.version}|`)
            .join(os.EOL);

        const extensionTable = `
${tableHeader}${os.EOL}${table};
`;

        return extensionTable;
    }

    private async getDotnetInfo(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            try {
                cp.exec('dotnet --info', { cwd: process.cwd(), maxBuffer: 500 * 1024 }, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                    } else if (stderr && stderr.length > 0) {
                        reject(error);
                    } else {
                        resolve(stdout);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }
}
