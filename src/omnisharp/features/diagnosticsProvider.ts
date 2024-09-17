/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmniSharpServer } from '../server';
import AbstractSupport from './abstractProvider';
import * as protocol from '../protocol';
import * as serverUtils from '../utils';
import { toRange } from '../typeConversion';
import * as vscode from 'vscode';
import CompositeDisposable from '../../compositeDisposable';
import { IDisposable } from '../../disposable';
import { isVirtualCSharpDocument } from './virtualDocumentTracker';
import { TextDocument } from '../../vscodeAdapter';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { BackgroundDiagnosticStatus } from '../protocol';
import { LanguageMiddlewareFeature } from '../languageMiddlewareFeature';
import { omnisharpOptions } from '../../shared/options';

export class Advisor {
    private _disposable: CompositeDisposable;
    private _server: OmniSharpServer;
    private _packageRestoreCounter = 0;
    private _projectSourceFileCounts: { [path: string]: number } = Object.create(null);

    constructor(server: OmniSharpServer) {
        this._server = server;

        const d1 = server.onProjectChange(this._onProjectChange, this);
        const d2 = server.onProjectAdded(this._onProjectAdded, this);
        const d3 = server.onProjectRemoved(this._onProjectRemoved, this);
        const d4 = server.onBeforePackageRestore(this._onBeforePackageRestore, this);
        const d5 = server.onPackageRestore(this._onPackageRestore, this);
        this._disposable = new CompositeDisposable(d1, d2, d3, d4, d5);
    }

    public dispose() {
        this._disposable.dispose();
    }

    public shouldValidateFiles(): boolean {
        return this._isServerStarted() && !this._isRestoringPackages();
    }

    public shouldValidateAll(): boolean {
        return this._isServerStarted() && !this._isRestoringPackages() && !this._isOverFileLimit();
    }

    private _updateProjectFileCount(path: string, fileCount: number): void {
        this._projectSourceFileCounts[path] = fileCount;
    }

    private _addOrUpdateProjectFileCount(info: protocol.ProjectInformationResponse): void {
        if (info.MsBuildProject && info.MsBuildProject.SourceFiles) {
            this._updateProjectFileCount(info.MsBuildProject.Path, info.MsBuildProject.SourceFiles.length);
        }
    }

    private _removeProjectFileCount(info: protocol.ProjectInformationResponse): void {
        if (info.MsBuildProject && info.MsBuildProject.SourceFiles) {
            delete this._projectSourceFileCounts[info.MsBuildProject.Path];
        }
    }

    private _onProjectAdded(info: protocol.ProjectInformationResponse): void {
        this._addOrUpdateProjectFileCount(info);
    }

    private _onProjectRemoved(info: protocol.ProjectInformationResponse): void {
        this._removeProjectFileCount(info);
    }

    private _onProjectChange(info: protocol.ProjectInformationResponse): void {
        this._addOrUpdateProjectFileCount(info);
    }

    private _onBeforePackageRestore(): void {
        this._packageRestoreCounter += 1;
    }

    private _onPackageRestore(): void {
        this._packageRestoreCounter -= 1;
    }

    private _isRestoringPackages(): boolean {
        return this._packageRestoreCounter > 0;
    }

    private _isServerStarted(): boolean {
        return this._server.isRunning();
    }

    private _isOverFileLimit(): boolean {
        const fileLimit = omnisharpOptions.maxProjectFileCountForDiagnosticAnalysis;
        if (fileLimit > 0) {
            let sourceFileCount = 0;
            for (const key in this._projectSourceFileCounts) {
                sourceFileCount += this._projectSourceFileCounts[key];
                if (sourceFileCount > fileLimit) {
                    return true;
                }
            }
        }
        return false;
    }
}

export default function reportDiagnostics(
    server: OmniSharpServer,
    advisor: Advisor,
    languageMiddlewareFeature: LanguageMiddlewareFeature
): IDisposable {
    return new OmniSharpDiagnosticsProvider(server, advisor, languageMiddlewareFeature);
}

class OmniSharpDiagnosticsProvider extends AbstractSupport {
    private _validationAdvisor: Advisor;
    private _disposable: CompositeDisposable;
    private _diagnostics: vscode.DiagnosticCollection;
    private _validateCurrentDocumentPipe = new Subject<vscode.TextDocument>();
    private _validateAllPipe = new Subject<string>();
    private _analyzersEnabled: boolean;
    private _subscriptions: Subscription[] = [];
    private _suppressHiddenDiagnostics: boolean;

    constructor(
        server: OmniSharpServer,
        validationAdvisor: Advisor,
        languageMiddlewareFeature: LanguageMiddlewareFeature
    ) {
        super(server, languageMiddlewareFeature);

        const analyzersEnabledLegacyOption = vscode.workspace
            .getConfiguration('omnisharp')
            .get('enableRoslynAnalyzers', false);
        const useOmnisharpServer = vscode.workspace.getConfiguration('dotnet').get('server.useOmnisharp', false);
        const analyzersEnabledNewOption =
            vscode.workspace
                .getConfiguration('dotnet')
                .get<string>(
                    'backgroundAnalysis.analyzerDiagnosticsScope',
                    useOmnisharpServer ? 'none' : 'openFiles'
                ) != 'none';
        this._analyzersEnabled = analyzersEnabledLegacyOption || analyzersEnabledNewOption;
        this._validationAdvisor = validationAdvisor;
        this._diagnostics = vscode.languages.createDiagnosticCollection('csharp');
        this._suppressHiddenDiagnostics = vscode.workspace
            .getConfiguration('csharp')
            .get('suppressHiddenDiagnostics', true);

        if (!omnisharpOptions.enableLspDriver) {
            this._subscriptions.push(
                this._validateCurrentDocumentPipe
                    .pipe(debounceTime(750))
                    .subscribe(async (document) => await this._validateDocument(document))
            );
        }

        this._subscriptions.push(
            this._validateAllPipe.pipe(debounceTime(3000)).subscribe(() => {
                if (this._validationAdvisor.shouldValidateAll()) {
                    this._validateEntireWorkspace();
                } else if (this._validationAdvisor.shouldValidateFiles()) {
                    this._validateOpenDocuments();
                }
            })
        );

        this._disposable = new CompositeDisposable(
            this._diagnostics,
            this._server.onPackageRestore(() => this._validateAllPipe.next('onPackageRestore'), this),
            this._server.onProjectChange(() => this._validateAllPipe.next('onProjectChanged'), this),
            this._server.onBackgroundDiagnosticStatus(this._onBackgroundAnalysis, this),
            vscode.workspace.onDidOpenTextDocument((event) => this._onDocumentOpenOrChange(event), this),
            vscode.workspace.onDidChangeTextDocument((event) => this._onDocumentOpenOrChange(event.document), this),
            vscode.workspace.onDidCloseTextDocument(this._onDocumentClose, this),
            vscode.window.onDidChangeActiveTextEditor((event) => this._onDidChangeActiveTextEditor(event), this),
            vscode.window.onDidChangeWindowState((event) => this._OnDidChangeWindowState(event), this)
        );
    }

    public dispose = () => {
        this._validateAllPipe.complete();
        this._validateCurrentDocumentPipe.complete();
        this._subscriptions.forEach((x) => x.unsubscribe());
        this._disposable.dispose();
    };

    private shouldIgnoreDocument(document: TextDocument) {
        if (document.languageId !== 'csharp') {
            return true;
        }

        if (document.uri.scheme !== 'file' && !isVirtualCSharpDocument(document)) {
            return true;
        }

        return false;
    }

    private _OnDidChangeWindowState(windowState: vscode.WindowState): void {
        if (windowState.focused === true) {
            this._onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
        }
    }

    private _onDidChangeActiveTextEditor(textEditor: vscode.TextEditor | undefined): void {
        // active text editor can be undefined.
        if (textEditor !== undefined) {
            this._onDocumentOpenOrChange(textEditor.document);
        }
    }

    private _onDocumentOpenOrChange(document: vscode.TextDocument): void {
        if (this.shouldIgnoreDocument(document)) {
            return;
        }

        this._validateCurrentDocumentPipe.next(document);

        // This check is just small perf optimization to reduce queries
        // for omnisharp with analyzers (which has event to notify about updates.)
        if (!this._analyzersEnabled) {
            this._validateAllPipe.next('onDocumentOpenOrChange');
        }
    }

    private _onBackgroundAnalysis(event: protocol.BackgroundDiagnosticStatusMessage) {
        if (event.Status == BackgroundDiagnosticStatus.Finished && event.NumberFilesRemaining === 0) {
            this._validateAllPipe.next();
        }
    }

    private _onDocumentClose(document: vscode.TextDocument): void {
        if (this._diagnostics.has(document.uri) && !this._validationAdvisor.shouldValidateAll()) {
            this._diagnostics.delete(document.uri);
        }
    }

    private async _validateDocument(document: vscode.TextDocument) {
        if (!this._validationAdvisor.shouldValidateFiles()) {
            return;
        }

        // No problems published for virtual files
        if (isVirtualCSharpDocument(document)) {
            return;
        }

        const source = new vscode.CancellationTokenSource();
        try {
            const value = await serverUtils.codeCheck(this._server, { FileName: document.fileName }, source.token);
            const quickFixes = value.QuickFixes;
            // Easy case: If there are no diagnostics in the file, we can clear it quickly.
            if (quickFixes.length === 0) {
                if (this._diagnostics.has(document.uri)) {
                    this._diagnostics.delete(document.uri);
                }

                return;
            }

            // If we're over the file limit and the file shouldn't have diagnostics, don't add them. This can
            // happen if a file is opened then immediately closed, as the on doc close event will occur before
            // diagnostics come back from the server.
            if (
                !this._validationAdvisor.shouldValidateAll() &&
                vscode.workspace.textDocuments.every((doc) => doc.uri !== document.uri)
            ) {
                return;
            }

            // (re)set new diagnostics for this document
            const diagnosticsInFile = this._mapQuickFixesAsDiagnosticsInFile(quickFixes);

            this._diagnostics.set(
                document.uri,
                diagnosticsInFile.map((x) => x.diagnostic)
            );
        } catch (_) {
            return;
        }
    }

    // On large workspaces (if maxProjectFileCountForDiagnosticAnalysis) is less than workspace size,
    // diagnostic fallback to mode where only open documents are analyzed.
    private async _validateOpenDocuments() {
        for (const editor of vscode.window.visibleTextEditors) {
            const document = editor.document;
            if (this.shouldIgnoreDocument(document)) {
                continue;
            }

            await this._validateDocument(document);
        }
    }

    private _mapQuickFixesAsDiagnosticsInFile(
        quickFixes: protocol.QuickFix[]
    ): { diagnostic: vscode.Diagnostic; fileName: string }[] {
        return quickFixes
            .map((quickFix) => this._asDiagnosticInFileIfAny(quickFix))
            .filter(
                (diagnosticInFile): diagnosticInFile is NonNullable<typeof diagnosticInFile> =>
                    diagnosticInFile !== undefined
            );
    }

    private async _validateEntireWorkspace() {
        const value = await serverUtils.codeCheck(this._server, {}, new vscode.CancellationTokenSource().token);

        const quickFixes = value.QuickFixes.sort((a, b) => a.FileName.localeCompare(b.FileName));

        const entries: [vscode.Uri, vscode.Diagnostic[] | undefined][] = [];
        let lastEntry: [vscode.Uri, vscode.Diagnostic[]] | undefined;

        for (const diagnosticInFile of this._mapQuickFixesAsDiagnosticsInFile(quickFixes)) {
            const uri = vscode.Uri.file(diagnosticInFile.fileName);

            if (lastEntry !== undefined && lastEntry[0].toString() === uri.toString()) {
                lastEntry[1].push(diagnosticInFile.diagnostic);
            } else {
                // We're replacing all diagnostics in this file. Pushing an entry with undefined for
                // the diagnostics first ensures that the previous diagnostics for this file are
                // cleared. Otherwise, new entries will be merged with the old ones.
                entries.push([uri, undefined]);
                lastEntry = [uri, [diagnosticInFile.diagnostic]];
                entries.push(lastEntry);
            }
        }

        // Clear diagnostics for files that no longer have any diagnostics.
        this._diagnostics.forEach((uri) => {
            if (entries.find((tuple) => tuple[0].toString() === uri.toString()) === undefined) {
                this._diagnostics.delete(uri);
            }
        });

        // replace all entries
        this._diagnostics.set(entries);
    }

    private _asDiagnosticInFileIfAny(
        quickFix: protocol.QuickFix
    ): { diagnostic: vscode.Diagnostic; fileName: string } | undefined {
        const display = this._getDiagnosticDisplay(quickFix, this._asDiagnosticSeverity(quickFix));

        if (display.severity === 'hidden') {
            return undefined;
        }

        const message = `${quickFix.Text} [${quickFix.Projects.map((n) => this._asProjectLabel(n)).join(', ')}]`;

        const diagnostic = new vscode.Diagnostic(toRange(quickFix), message, display.severity);
        diagnostic.source = 'csharp';
        diagnostic.code = quickFix.Id;

        if (display.isFadeout) {
            diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
        }

        return { diagnostic: diagnostic, fileName: quickFix.FileName };
    }

    private _getDiagnosticDisplay(
        quickFix: protocol.QuickFix,
        severity: vscode.DiagnosticSeverity | 'hidden'
    ): { severity: vscode.DiagnosticSeverity | 'hidden'; isFadeout: boolean } {
        // These hard coded values bring the goodness of fading even when analyzers are disabled.
        const isFadeout =
            quickFix.Tags?.find((x) => x.toLowerCase() === 'unnecessary') !== undefined ||
            quickFix.Id == 'CS0162' || // CS0162: Unreachable code
            quickFix.Id == 'CS0219' || // CS0219: Unused variable
            quickFix.Id == 'CS8019'; // CS8019: Unnecessary using

        if (isFadeout && ['hidden', 'none'].includes(quickFix.LogLevel.toLowerCase())) {
            // Theres no such thing as hidden severity in VSCode,
            // however roslyn uses commonly analyzer with hidden to fade out things.
            // Without this any of those doesn't fade anything in vscode.
            return { severity: vscode.DiagnosticSeverity.Hint, isFadeout };
        }

        return { severity: severity, isFadeout };
    }

    private _asDiagnosticSeverity(quickFix: protocol.QuickFix): vscode.DiagnosticSeverity | 'hidden' {
        switch (quickFix.LogLevel.toLowerCase()) {
            case 'error':
                return vscode.DiagnosticSeverity.Error;
            case 'warning':
                return vscode.DiagnosticSeverity.Warning;
            case 'info':
                return vscode.DiagnosticSeverity.Information;
            case 'hidden':
                if (this._suppressHiddenDiagnostics) {
                    return 'hidden';
                }
                return vscode.DiagnosticSeverity.Hint;
            default:
                return 'hidden';
        }
    }

    private _asProjectLabel(projectName: string): string {
        const idx = projectName.indexOf('+');
        return projectName.substr(idx + 1);
    }
}
