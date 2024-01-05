/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RazorLogger } from '../razorLogger';
import { LogLevel } from '../logLevel';
import { ReportIssueCreator } from './reportIssueCreator';
import { ReportIssueDataCollector } from './reportIssueDataCollector';
import { ReportIssueDataCollectorFactory } from './reportIssueDataCollectorFactory';

export class ReportIssuePanel {
    public static readonly viewType = 'razorReportIssue';

    private panel: vscode.WebviewPanel | undefined;
    private dataCollector: ReportIssueDataCollector | undefined;
    private issueContent: string | undefined;
    private traceLevelChange: vscode.Disposable | undefined;

    constructor(
        private readonly dataCollectorFactory: ReportIssueDataCollectorFactory,
        private readonly reportIssueCreator: ReportIssueCreator,
        private readonly logger: RazorLogger
    ) {}

    public async show() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Two);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                ReportIssuePanel.viewType,
                vscode.l10n.t('Report Razor Issue'),
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

    private attachToCurrentPanel() {
        if (!this.panel) {
            vscode.window.showErrorMessage(
                vscode.l10n.t('Unexpected error when attaching to report Razor issue window.')
            );
            return;
        }

        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'copyIssue':
                    if (!this.issueContent) {
                        if (!this.dataCollector) {
                            vscode.window.showErrorMessage(
                                vscode.l10n.t('You must first start the data collection before copying.')
                            );
                            return;
                        }
                        const collectionResult = this.dataCollector.collect();
                        this.issueContent = await this.reportIssueCreator.create(collectionResult);
                        this.dataCollector = undefined;
                    }

                    await vscode.env.clipboard.writeText(this.issueContent);
                    vscode.window.showInformationMessage(vscode.l10n.t('Razor issue copied to clipboard'));
                    return;
                case 'startIssue':
                    if (this.dataCollector) {
                        this.dataCollector.stop();
                        this.dataCollector = undefined;
                    }
                    this.issueContent = undefined;
                    this.dataCollector = this.dataCollectorFactory.create();
                    vscode.window.showInformationMessage(
                        vscode.l10n.t('Razor issue data collection started. Reproduce the issue then press "Stop"')
                    );
                    return;
                case 'stopIssue':
                    if (!this.dataCollector) {
                        vscode.window.showErrorMessage(
                            vscode.l10n.t('You must first start the data collection before stopping.')
                        );
                        return;
                    }
                    this.dataCollector.stop();
                    vscode.window.showInformationMessage(
                        vscode.l10n.t('Razor issue data collection stopped. Copying issue content...')
                    );
                    return;
            }
        });

        this.traceLevelChange = this.logger.onTraceLevelChange(async () => this.update());

        this.panel.onDidDispose(() => {
            if (this.traceLevelChange) {
                this.traceLevelChange.dispose();
            }
            this.panel = undefined;
        });
    }

    private async update() {
        if (!this.panel) {
            return;
        }

        let panelBodyContent = '';
        if (this.logger.logLevel.valueOf() <= LogLevel.Debug) {
            const startButtonLabel = vscode.l10n.t('Start');
            const startButton = `<button onclick="startIssue()">${startButtonLabel}</button>`;
            const firstLine = vscode.l10n.t('Press {0}', startButton);
            const secondLine = vscode.l10n.t('Perform the actions (or no action) that resulted in your Razor issue');

            const stopButtonLabel = vscode.l10n.t('Stop');
            const stopButton = `<button onclick="stopIssue()">${stopButtonLabel}</button>`;
            const thirdLine = vscode.l10n.t('Click {0}. This will copy all relevant issue information.', stopButton);

            const gitHubAnchorLabel = vscode.l10n.t('Go to GitHub');
            const gitHubAnchor = `<a href="https://github.com/dotnet/razor/issues/new?template=bug_report.md&labels=vscode%2C+bug">${gitHubAnchorLabel}</a>`;
            const fourthLine = vscode.l10n.t(
                "{0}, paste your issue contents as the body of the issue. Don't forget to fill out any details left unfilled.",
                gitHubAnchor
            );

            const ll_cc = vscode.env.language; // may have the 'cc' portion or just be the language 'll' portion
            const privacyAnchor = `<a href="https://privacy.microsoft.com/${ll_cc}/privacystatement">https://privacy.microsoft.com/${ll_cc}/privacystatement</a>`;
            const privacyStatement = vscode.l10n.t(
                'Privacy Alert! The contents copied to your clipboard may contain personal data. Prior to posting to GitHub, please remove any personal data which should not be publicly viewable.'
            );

            const copyIssueContentLabel = vscode.l10n.t('Copy issue content again');

            panelBodyContent = `<ol>
    <li>${firstLine}</li>
    <li>${secondLine}</li>
    <li>${thirdLine}</li>
    <li>${fourthLine}</li>
</ol>

<p><em>${privacyStatement}
${privacyAnchor}
</em></p>

<button onclick="copyIssue()">${copyIssueContentLabel}</button>`;
        } else {
            const verbositySettingName = `<strong><em>${RazorLogger.verbositySetting}</em></strong>`;
            const currentVerbositySettingValue = `<strong><em>${LogLevel[this.logger.logLevel]}</em></strong>`;
            const neededVerbositySettingValue = `<strong><em>${LogLevel[LogLevel.Debug]}</em></strong>`;

            panelBodyContent =
                '<p>' +
                vscode.l10n.t(
                    'Cannot start collecting Razor logs when {0} is set to {1}. Please set {0} to {2} and then reload your VSCode environment and re-run the report Razor issue command.',
                    verbositySettingName,
                    currentVerbositySettingValue,
                    neededVerbositySettingValue
                ) +
                '</p>';
        }

        const title: string = vscode.l10n.t('Report a Razor issue');
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
        body {
            font-size: 20px;
        }
        strong {
            color: red;
        }
    </style>

    <script type="text/javascript">
        const vscode = acquireVsCodeApi();
        function copyIssue() {
            vscode.postMessage({
                command: 'copyIssue'
            });
        }
        function startIssue() {
            vscode.postMessage({
                command: 'startIssue'
            });
        }
        function stopIssue() {
            vscode.postMessage({
                command: 'stopIssue'
            });
            copyIssue();
        }
    </script>
</head>
<body>
<h3>${title}</h3>
${panelBodyContent}
</body>
</html>`;
    }
}
