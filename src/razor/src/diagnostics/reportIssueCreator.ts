/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as os from 'os';
import * as vscode from '../vscodeAdapter';
import * as l10n from '@vscode/l10n';
import { IRazorDocument } from '../document/IRazorDocument';
import { IRazorDocumentManager } from '../document/IRazorDocumentManager';
import { razorExtensionId } from '../razorExtensionId';
import { IReportIssueDataCollectionResult } from './IReportIssueDataCollectionResult';

export class ReportIssueCreator {
    constructor(private readonly vscodeApi: vscode.api, private readonly documentManager: IRazorDocumentManager) {}

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
            razorContent = l10n.t('Non Razor file as active document');
            csharpContent = l10n.t('Could not determine CSharp content');
            htmlContent = l10n.t('Could not determine Html content');
        }

        const razorExtensionVersion = this.getExtensionVersion();
        let dotnetInfo = '';
        try {
            dotnetInfo = await this.getDotnetInfo();
        } catch (error: any) {
            dotnetInfo = l10n.t('A valid dotnet installation could not be found: {0}', error?.toString());
        }
        const extensionTable = this.generateExtensionTable();

        const sanitizedLogOutput = this.sanitize(collectionResult.logOutput);
        const sanitizedRazorContent = this.sanitize(razorContent);
        const sanitizedCSharpContent = this.sanitize(csharpContent);
        const sanitizedHtmlContent = this.sanitize(htmlContent);
        const sanitizedDotnetInfo = this.sanitize(dotnetInfo);

        const issueType = l10n.t('Is this a Bug or Feature request?');

        const defaultIssueType = l10n.t('Is this a Bug or Feature request?');

        const reproStepsHeader = l10n.t('Steps to reproduce');
        const genericPlaceholderContent = l10n.t('Please fill in this section');
        const problemDescriptionHeader = l10n.t('Description of the problem');
        const expectedBehaviorHeader = l10n.t('Expected behavior');
        const actualBehaviorHeader = l10n.t('Actual behavior');
        const logsHeader = l10n.t('Logs');

        const omniSharpHeader = l10n.t('OmniSharp');
        const omniSharpInstructions = l10n.t(
            "To find the OmniSharp log, open VS Code's" + ' "Output" pane, then in the dropdown choose "OmniSharp Log".'
        );
        const razorHeader = l10n.t('Razor');
        const expandText = l10n.t('Expand');

        const workspaceInfo = l10n.t('Workspace information');
        const razorDocument = l10n.t('Razor document');
        const projectedCSDocument = l10n.t('Projected CSharp document');
        const projectedHtmlDocument = l10n.t('Projected Html document');
        const machineInfo = l10n.t('Machine information');
        const razorVersion = l10n.t('Razor.VSCode version');
        const vscodeVersion = l10n.t('VSCode version');
        const extensionsLabel = l10n.t('Extensions');

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
    protected async getRazor(document: vscode.TextDocument) {
        const content = document.getText();

        return content;
    }

    // Protected for testing
    protected async getProjectedCSharp(razorDocument: IRazorDocument) {
        const projectedCSharpHeaderFooter = l10n.t('CSharp as seen by extension');

        let csharpContent = `////////////////////// ${projectedCSharpHeaderFooter} ///////////////////////
${razorDocument.csharpDocument.getContent()}


////////////////////// ${projectedCSharpHeaderFooter} ///////////////////////`;

        const errorSuffix = l10n.t("Unable to resolve VSCode's version of CSharp");
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
        } catch (e) {
            csharpContent = `${csharpContent}
${errorSuffix}`;
        }

        return csharpContent;
    }

    // Protected for testing
    protected async getProjectedHtml(razorDocument: IRazorDocument) {
        const projectedHTmlHeaderFooter = l10n.t('Projected Html as seen by extension');
        let htmlContent = `////////////////////// ${projectedHTmlHeaderFooter} ///////////////////////
${razorDocument.htmlDocument.getContent()}


////////////////////// ${projectedHTmlHeaderFooter} ///////////////////////`;

        const errorSuffix = l10n.t("Unable to resolve VSCode's version of Html");
        try {
            const htmlTextDocument = await this.vscodeApi.workspace.openTextDocument(razorDocument.htmlDocument.uri);
            if (htmlTextDocument) {
                htmlContent = `${htmlContent}
${htmlTextDocument.getText()}`;
            } else {
                htmlContent = `${htmlContent}
${errorSuffix}`;
            }
        } catch (e) {
            htmlContent = `${htmlContent}
${errorSuffix}`;
        }

        return htmlContent;
    }

    // Protected for testing
    protected getExtensionVersion(): string {
        const extension = this.vscodeApi.extensions.getExtension(razorExtensionId);
        if (!extension) {
            return l10n.t('Unable to find Razor extension version.');
        }
        return extension.packageJSON.version;
    }

    // Protected for testing
    protected getInstalledExtensions() {
        const extensions: Array<vscode.Extension<any>> = this.vscodeApi.extensions.all.filter(
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

        const extensionLabel = l10n.t('Extension');
        const authorLabel = l10n.t('Author');
        const versionLabel = l10n.t('Version');
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
