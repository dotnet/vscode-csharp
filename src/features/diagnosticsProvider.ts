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

export default function reportDiagnostics(server: OmniSharpServer, advisor: Advisor): IDisposable {
    return new DiagnosticsProvider(server, advisor);
}

class DiagnosticsProvider extends AbstractSupport {

    private _validationAdvisor: Advisor;
    private _disposable: CompositeDisposable;
    private _diagnostics: vscode.DiagnosticCollection;
    private _validateDocumentStream = new Subject<vscode.TextDocument>();
    private _validateAllStream = new Subject();
    private _analyzersEnabled: boolean;
    private _subscriptions: Subscription[] = [];

    constructor(server: OmniSharpServer, validationAdvisor: Advisor) {
        super(server);

        this._analyzersEnabled = vscode.workspace.getConfiguration('omnisharp').get('enableRoslynAnalyzers', false);
        this._validationAdvisor = validationAdvisor;
        this._diagnostics = vscode.languages.createDiagnosticCollection('csharp');

        this._subscriptions.push(this._validateDocumentStream
            .asObservable()
            .pipe(throttleTime(750))
            .subscribe(async x => await this._validateDocument(x)));

        this._subscriptions.push(this._validateAllStream
            .asObservable()
            .pipe(throttleTime(3000))
            .subscribe(async () => await this._validateAll()));

        this._disposable = new CompositeDisposable(this._diagnostics,
            this._server.onPackageRestore(() => this._validateAllStream.next(), this),
            this._server.onProjectChange(() => this._validateAllStream.next(), this),
            this._server.onProjectDiagnosticStatus(this._onProjectAnalysis, this),
            vscode.workspace.onDidOpenTextDocument(event => this._onDocumentAddOrChange(event), this),
            vscode.workspace.onDidChangeTextDocument(event => this._onDocumentAddOrChange(event.document), this),
            vscode.workspace.onDidCloseTextDocument(this._onDocumentRemove, this),
            vscode.window.onDidChangeActiveTextEditor(event => this._onDidChangeActiveTextEditor(event), this),
            vscode.window.onDidChangeWindowState(event => this._OnDidChangeWindowState(event), this),
        );

        // // Go ahead and check for diagnostics in the currently visible editors.
        // for (let editor of vscode.window.visibleTextEditors) {
        //     let document = editor.document;
        //     if (this.shouldIgnoreDocument(document)) {
        //         continue;
        //     }

        //     this._validateDocumentStream.next(document);
        // }
    }

    public dispose = () => {
        this._validateAllStream.complete();
        this._validateDocumentStream.complete();
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
            this._onDocumentAddOrChange(textEditor.document);
        }
    }

    private _onDocumentAddOrChange(document: vscode.TextDocument): void {
        if (this.shouldIgnoreDocument(document)) {
            return;
        }

        this._validateDocumentStream.next(document);

        // This check is just small perf optimization to reduce queries
        // for omnisharp with analyzers (which have enents to notify updates.)
        if(!this._analyzersEnabled)
        {
            this._validateAllStream.next();
        }
    }

    private _onProjectAnalysis(event: protocol.ProjectDiagnosticStatus) {
        if (event.Status == DiagnosticStatus.Ready) {
            this._validateAllStream.next();
        }
    }

    private _onDocumentRemove(document: vscode.TextDocument): void {
        this._validateAllStream.next();
    }

    private async _validateDocument(document: vscode.TextDocument): Promise<void> {
        if (!this._validationAdvisor.shouldValidateFiles()) {
            return;
        }

        await setTimeout(async () => {
            let source = new vscode.CancellationTokenSource();
            try {
                let value = await serverUtils.codeCheck(this._server, { FileName: document.fileName }, source.token);
                let quickFixes = value.QuickFixes.filter(DiagnosticsProvider._shouldInclude);
                // Easy case: If there are no diagnostics in the file, we can clear it quickly.
                if (quickFixes.length === 0) {
                    if (this._diagnostics.has(document.uri)) {
                        this._diagnostics.delete(document.uri);
                    }

                    return;
                }

                // (re)set new diagnostics for this document
                let diagnostics = quickFixes.map(DiagnosticsProvider._asDiagnostic);
                this._diagnostics.set(document.uri, diagnostics);
            }
            catch (error) {
                return;
            }
        }, 2000);
    }

    private async _validateAll(): Promise<void> {
        if (!this._validationAdvisor.shouldValidateAll()) {
            return;
        }

        await setTimeout(async() => {
            try {
                let value = await serverUtils.codeCheck(this._server, { FileName: null }, new vscode.CancellationTokenSource().token);

                let quickFixes = value.QuickFixes
                    .filter(DiagnosticsProvider._shouldInclude)
                    .sort((a, b) => a.FileName.localeCompare(b.FileName));

                let entries: [vscode.Uri, vscode.Diagnostic[]][] = [];
                let lastEntry: [vscode.Uri, vscode.Diagnostic[]];

                for (let quickFix of quickFixes) {

                    let diag = DiagnosticsProvider._asDiagnostic(quickFix);
                    let uri = vscode.Uri.file(quickFix.FileName);

                    if (lastEntry && lastEntry[0].toString() === uri.toString()) {
                        lastEntry[1].push(diag);
                    } else {
                        // We're replacing all diagnostics in this file. Pushing an entry with undefined for
                        // the diagnostics first ensures that the previous diagnostics for this file are
                        // cleared. Otherwise, new entries will be merged with the old ones.
                        entries.push([uri, undefined]);
                        lastEntry = [uri, [diag]];
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
            }
            catch (error) {
                return;
            }
        }, 3000);
    }

    private static _shouldInclude(quickFix: protocol.QuickFix): boolean {
        const config = vscode.workspace.getConfiguration('csharp');
        if (config.get('suppressHiddenDiagnostics', true)) {
            return quickFix.LogLevel.toLowerCase() !== 'hidden';
        } else {
            return true;
        }
    }

    // --- data converter

    private static _asDiagnostic(quickFix: protocol.QuickFix): vscode.Diagnostic {
        let severity = DiagnosticsProvider._asDiagnosticSeverity(quickFix.LogLevel);
        let message = `${quickFix.Text} [${quickFix.Projects.map(n => DiagnosticsProvider._asProjectLabel(n)).join(', ')}]`;
        return new vscode.Diagnostic(toRange(quickFix), message, severity);
    }

    private static _asDiagnosticSeverity(logLevel: string): vscode.DiagnosticSeverity {
        switch (logLevel.toLowerCase()) {
            case 'error':
                return vscode.DiagnosticSeverity.Error;
            case 'warning':
                return vscode.DiagnosticSeverity.Warning;
            // info and hidden
            default:
                return vscode.DiagnosticSeverity.Information;
        }
    }

    private static _asProjectLabel(projectName: string): string {
        const idx = projectName.indexOf('+');
        return projectName.substr(idx + 1);
    }
}
