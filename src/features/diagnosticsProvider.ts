/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmniSharpServer } from '../omnisharp/server';
import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { toRange } from '../omnisharp/typeConversion';
import * as vscode from 'vscode';
import CompositeDisposable from '../CompositeDisposable';
import { IDisposable } from '../Disposable';
import { isVirtualCSharpDocument } from './virtualDocumentTracker';
import { TextDocument } from '../vscodeAdapter';
import OptionProvider from '../observers/OptionProvider';
import { Subject, Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { DiagnosticStatus } from '../omnisharp/protocol';
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';

export class Advisor {

    private _disposable: CompositeDisposable;
    private _server: OmniSharpServer;
    private _packageRestoreCounter: number = 0;
    private _projectSourceFileCounts: { [path: string]: number } = Object.create(null);

    constructor(server: OmniSharpServer, private optionProvider: OptionProvider) {
        this._server = server;

        let d1 = server.onProjectChange(this._onProjectChange, this);
        let d2 = server.onProjectAdded(this._onProjectAdded, this);
        let d3 = server.onProjectRemoved(this._onProjectRemoved, this);
        let d4 = server.onBeforePackageRestore(this._onBeforePackageRestore, this);
        let d5 = server.onPackageRestore(this._onPackageRestore, this);
        this._disposable = new CompositeDisposable(d1, d2, d3, d4, d5);
    }

    public dispose() {
        this._disposable.dispose();
    }

    public shouldValidateFiles(): boolean {
        return this._isServerStarted()
            && !this._isRestoringPackages();
    }

    public shouldValidateAll(): boolean {
        return this._isServerStarted()
            && !this._isRestoringPackages()
            && !this._isOverFileLimit();
    }

    private _updateProjectFileCount(path: string, fileCount: number): void {
        this._projectSourceFileCounts[path] = fileCount;
    }

    private _addOrUpdateProjectFileCount(info: protocol.ProjectInformationResponse): void {
        if (info.DotNetProject && info.DotNetProject.SourceFiles) {
            this._updateProjectFileCount(info.DotNetProject.Path, info.DotNetProject.SourceFiles.length);
        }

        if (info.MsBuildProject && info.MsBuildProject.SourceFiles) {
            this._updateProjectFileCount(info.MsBuildProject.Path, info.MsBuildProject.SourceFiles.length);
        }
    }

    private _removeProjectFileCount(info: protocol.ProjectInformationResponse): void {
        if (info.DotNetProject && info.DotNetProject.SourceFiles) {
            delete this._projectSourceFileCounts[info.DotNetProject.Path];
        }

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
        let opts = this.optionProvider.GetLatestOptions();
        let fileLimit = opts.maxProjectFileCountForDiagnosticAnalysis;
        if (fileLimit > 0) {
            let sourceFileCount = 0;
            for (let key in this._projectSourceFileCounts) {
                sourceFileCount += this._projectSourceFileCounts[key];
                if (sourceFileCount > fileLimit) {
                    return true;
                }
            }
        }
        return false;
    }
}

export default function reportDiagnostics(server: OmniSharpServer, advisor: Advisor, languageMiddlewareFeature: LanguageMiddlewareFeature): IDisposable {
    return new DiagnosticsProvider(server, advisor, languageMiddlewareFeature);
}

class DiagnosticsProvider extends AbstractSupport {

    private _validationAdvisor: Advisor;
    private _disposable: CompositeDisposable;
    private _diagnostics: vscode.DiagnosticCollection;
    private _validateCurrentDocumentPipe = new Subject<vscode.TextDocument>();
    private _validateAllPipe = new Subject();
    private _analyzersEnabled: boolean;
    private _subscriptions: Subscription[] = [];
    private _suppressHiddenDiagnostics: boolean;

    constructor(server: OmniSharpServer, validationAdvisor: Advisor, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);

        this._analyzersEnabled = vscode.workspace.getConfiguration('omnisharp').get('enableRoslynAnalyzers', false);
        this._validationAdvisor = validationAdvisor;
        this._diagnostics = vscode.languages.createDiagnosticCollection('csharp');
        this._suppressHiddenDiagnostics = vscode.workspace.getConfiguration('csharp').get('suppressHiddenDiagnostics', true);

        this._subscriptions.push(this._validateCurrentDocumentPipe
            .asObservable()
            .pipe(throttleTime(750))
            .subscribe(async x => await this._validateDocument(x)));

        this._subscriptions.push(this._validateAllPipe
            .asObservable()
            .pipe(throttleTime(3000))
            .subscribe(async () => {
                if (this._validationAdvisor.shouldValidateAll()) {
                    await this._validateEntireWorkspace();
                }
                else if (this._validationAdvisor.shouldValidateFiles()) {
                    await this._validateOpenDocuments();
                }
            }));


        this._disposable = new CompositeDisposable(this._diagnostics,
            this._server.onPackageRestore(() => this._validateAllPipe.next(), this),
            this._server.onProjectChange(() => this._validateAllPipe.next(), this),
            this._server.onProjectDiagnosticStatus(this._onProjectAnalysis, this),
            vscode.workspace.onDidOpenTextDocument(event => this._onDocumentOpenOrChange(event), this),
            vscode.workspace.onDidChangeTextDocument(event => this._onDocumentOpenOrChange(event.document), this),
            vscode.workspace.onDidCloseTextDocument(this._onDocumentClose, this),
            vscode.window.onDidChangeActiveTextEditor(event => this._onDidChangeActiveTextEditor(event), this),
            vscode.window.onDidChangeWindowState(event => this._OnDidChangeWindowState(event), this,),
        );
    }

    public dispose = () => {
        this._validateAllPipe.complete();
        this._validateCurrentDocumentPipe.complete();
        this._subscriptions.forEach(x => x.unsubscribe());
        this._disposable.dispose();
    }

    private shouldIgnoreDocument(document: TextDocument) {
        if (document.languageId !== 'csharp') {
            return true;
        }

        if (document.uri.scheme !== 'file' &&
            !isVirtualCSharpDocument(document)) {
            return true;
        }

        return false;
    }

    private _OnDidChangeWindowState(windowState: vscode.WindowState): void {
        if (windowState.focused === true) {
            this._onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
        }
    }

    private _onDidChangeActiveTextEditor(textEditor: vscode.TextEditor): void {
        // active text editor can be undefined.
        if (textEditor != undefined && textEditor.document != null) {
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
            this._validateAllPipe.next();
        }
    }

    private _onProjectAnalysis(event: protocol.ProjectDiagnosticStatus) {
        if (event.Status == DiagnosticStatus.Ready) {
            this._validateAllPipe.next();
        }
    }

    private _onDocumentClose(document: vscode.TextDocument): void {
        if (this._diagnostics.has(document.uri) && !this._validationAdvisor.shouldValidateAll()) {
            this._diagnostics.delete(document.uri);
        }
    }

    private _validateDocument(document: vscode.TextDocument): NodeJS.Timeout {
        if (!this._validationAdvisor.shouldValidateFiles()) {
            return;
        }

        return setTimeout(async () => {
            let source = new vscode.CancellationTokenSource();
            try {
                let value = await serverUtils.codeCheck(this._server, { FileName: document.fileName }, source.token);
                let quickFixes = value.QuickFixes;
                // Easy case: If there are no diagnostics in the file, we can clear it quickly.
                if (quickFixes.length === 0) {
                    if (this._diagnostics.has(document.uri)) {
                        this._diagnostics.delete(document.uri);
                    }

                    return;
                }

                // (re)set new diagnostics for this document
                let diagnosticsInFile = this._mapQuickFixesAsDiagnosticsInFile(quickFixes);

                this._diagnostics.set(document.uri, diagnosticsInFile.map(x => x.diagnostic));
            }
            catch (error) {
                return;
            }
        }, 2000);
    }

    // On large workspaces (if maxProjectFileCountForDiagnosticAnalysis) is less than workspace size,
    // diagnostic fallback to mode where only open documents are analyzed.
    private _validateOpenDocuments(): NodeJS.Timeout {
        return setTimeout(async () => {
            for (let editor of vscode.window.visibleTextEditors) {
                let document = editor.document;
                if (this.shouldIgnoreDocument(document)) {
                    continue;
                }

                await this._validateDocument(document);
            }
        }, 3000);
    }

    private _mapQuickFixesAsDiagnosticsInFile(quickFixes: protocol.QuickFix[]): { diagnostic: vscode.Diagnostic, fileName: string }[] {
        return quickFixes
            .map(quickFix => this._asDiagnosticInFileIfAny(quickFix))
            .filter(diagnosticInFile => diagnosticInFile !== undefined);
    }

    private _validateEntireWorkspace(): NodeJS.Timeout {
        return setTimeout(async () => {
            let value = await serverUtils.codeCheck(this._server, { FileName: null }, new vscode.CancellationTokenSource().token);

            let quickFixes = value.QuickFixes
                .sort((a, b) => a.FileName.localeCompare(b.FileName));

            let entries: [vscode.Uri, vscode.Diagnostic[]][] = [];
            let lastEntry: [vscode.Uri, vscode.Diagnostic[]];

            for (let diagnosticInFile of this._mapQuickFixesAsDiagnosticsInFile(quickFixes)) {
                let uri = vscode.Uri.file(diagnosticInFile.fileName);

                if (lastEntry && lastEntry[0].toString() === uri.toString()) {
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
                if (!entries.find(tuple => tuple[0].toString() === uri.toString())) {
                    this._diagnostics.delete(uri);
                }
            });

            // replace all entries
            this._diagnostics.set(entries);
        }, 3000);
    }

    private _asDiagnosticInFileIfAny(quickFix: protocol.QuickFix): { diagnostic: vscode.Diagnostic, fileName: string } {
        let display = this._getDiagnosticDisplay(quickFix, this._asDiagnosticSeverity(quickFix));

        if (display.severity === "hidden") {
            return undefined;
        }

        let message = `${quickFix.Text} [${quickFix.Projects.map(n => this._asProjectLabel(n)).join(', ')}]`;

        let diagnostic = new vscode.Diagnostic(toRange(quickFix), message, display.severity);
        diagnostic.source = 'csharp';
        diagnostic.code = quickFix.Id;

        if (display.isFadeout) {
            diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
        }

        return { diagnostic: diagnostic, fileName: quickFix.FileName };
    }

    private _getDiagnosticDisplay(quickFix: protocol.QuickFix, severity: vscode.DiagnosticSeverity | "hidden"): { severity: vscode.DiagnosticSeverity | "hidden", isFadeout: boolean }
    {
        // CS0162 & CS8019 => Unnused using and unreachable code.
        // These hard coded values bring some goodnes of fading even when analyzers are disabled.
        let isFadeout = (quickFix.Tags && !!quickFix.Tags.find(x => x.toLowerCase() == 'unnecessary')) || quickFix.Id == "CS0162" || quickFix.Id == "CS8019";

        if (isFadeout && quickFix.LogLevel.toLowerCase() === 'hidden' || quickFix.LogLevel.toLowerCase() === 'none') {
            // Theres no such thing as hidden severity in VSCode,
            // however roslyn uses commonly analyzer with hidden to fade out things.
            // Without this any of those doesn't fade anything in vscode.
            return { severity: vscode.DiagnosticSeverity.Hint , isFadeout };
        }

        return { severity: severity, isFadeout };
    }

    private _asDiagnosticSeverity(quickFix: protocol.QuickFix): vscode.DiagnosticSeverity | "hidden" {
        switch (quickFix.LogLevel.toLowerCase()) {
            case 'error':
                return vscode.DiagnosticSeverity.Error;
            case 'warning':
                return vscode.DiagnosticSeverity.Warning;
            case 'info':
                return vscode.DiagnosticSeverity.Information;
            case 'hidden':
                if (this._suppressHiddenDiagnostics) {
                    return "hidden";
                }
                return vscode.DiagnosticSeverity.Hint;
            default:
                return "hidden";
        }
    }

    private _asProjectLabel(projectName: string): string {
        const idx = projectName.indexOf('+');
        return projectName.substr(idx + 1);
    }
}
