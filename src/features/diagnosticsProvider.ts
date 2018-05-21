/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmniSharpServer } from '../omnisharp/server';
import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { toRange } from '../omnisharp/typeConvertion';
import * as vscode from 'vscode';
import CompositeDisposable from '../CompositeDisposable';
import { IDisposable } from '../Disposable';

export class Advisor {

    private _disposable: CompositeDisposable;
    private _server: OmniSharpServer;
    private _packageRestoreCounter: number = 0;
    private _projectSourceFileCounts: { [path: string]: number } = Object.create(null);

    constructor(server: OmniSharpServer) {
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

    public shouldValidateProject(): boolean {
        return this._isServerStarted()
            && !this._isRestoringPackages()
            && !this._isHugeProject();
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

    private _isHugeProject(): boolean {
        let sourceFileCount = 0;
        for (let key in this._projectSourceFileCounts) {
            sourceFileCount += this._projectSourceFileCounts[key];
            if (sourceFileCount > 1000) {
                return true;
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
    private _documentValidations: { [uri: string]: vscode.CancellationTokenSource } = Object.create(null);
    private _projectValidation: vscode.CancellationTokenSource;
    private _diagnostics: vscode.DiagnosticCollection;

    constructor(server: OmniSharpServer, validationAdvisor: Advisor) {
        super(server);

        this._validationAdvisor = validationAdvisor;
        this._diagnostics = vscode.languages.createDiagnosticCollection('csharp');

        let d1 = this._server.onPackageRestore(this._validateProject, this);
        let d2 = this._server.onProjectChange(this._validateProject, this);
        let d4 = vscode.workspace.onDidOpenTextDocument(event => this._onDocumentAddOrChange(event), this);
        let d3 = vscode.workspace.onDidChangeTextDocument(event => this._onDocumentAddOrChange(event.document), this);
        let d5 = vscode.workspace.onDidCloseTextDocument(this._onDocumentRemove, this);
        let d6 = vscode.window.onDidChangeActiveTextEditor(event => this._onDidChangeActiveTextEditor(event), this);
        let d7 = vscode.window.onDidChangeWindowState(event => this._OnDidChangeWindowState(event), this);
        this._disposable = new CompositeDisposable(this._diagnostics, d1, d2, d3, d4, d5, d6, d7);

        // Go ahead and check for diagnostics in the currently visible editors.
        for (let editor of vscode.window.visibleTextEditors) {
            let document = editor.document;
            if (document.languageId === 'csharp' && document.uri.scheme === 'file') {
                this._validateDocument(document);
            }
        }
    }

    public dispose = () => {
        if (this._projectValidation) {
            this._projectValidation.dispose();
        }

        for (let key in this._documentValidations) {
            this._documentValidations[key].dispose();
        }

        this._disposable.dispose();
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
        if (document.languageId === 'csharp' && document.uri.scheme === 'file') {
            this._validateDocument(document);
            this._validateProject();
        }
    }

    private _onDocumentRemove(document: vscode.TextDocument): void {
        let key = document.uri;
        let didChange = false;
        if (this._diagnostics.get(key)) {
            didChange = true;
            this._diagnostics.delete(key);
        }

        let keyString = key.toString();

        if (this._documentValidations[keyString]) {
            didChange = true;
            this._documentValidations[keyString].cancel();
            delete this._documentValidations[keyString];
        }
        if (didChange) {
            this._validateProject();
        }
    }

    private _validateDocument(document: vscode.TextDocument): void {
        // If we've already started computing for this document, cancel that work.
        let key = document.uri.toString();
        if (this._documentValidations[key]) {
            this._documentValidations[key].cancel();
        }

        if (!this._validationAdvisor.shouldValidateFiles()) {
            return;
        }

        let source = new vscode.CancellationTokenSource();
        let handle = setTimeout(() => {
            serverUtils.codeCheck(this._server, { FileName: document.fileName }, source.token).then(value => {

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
            });
        }, 750);

        source.token.onCancellationRequested(() => clearTimeout(handle));
        this._documentValidations[key] = source;
    }

    private _validateProject(): void {
        // If we've already started computing for this project, cancel that work.
        if (this._projectValidation) {
            this._projectValidation.cancel();
        }

        if (!this._validationAdvisor.shouldValidateProject()) {
            return;
        }

        this._projectValidation = new vscode.CancellationTokenSource();
        let handle = setTimeout(() => {

            serverUtils.codeCheck(this._server, { FileName: null }, this._projectValidation.token).then(value => {

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
                this._diagnostics.forEach((uri, diagnostics) => {
                    if (!entries.find(tuple => tuple[0].toString() === uri.toString())) {
                        this._diagnostics.delete(uri);
                    }
                });

                // replace all entries
                this._diagnostics.set(entries);
            });
        }, 3000);

        // clear timeout on cancellation
        this._projectValidation.token.onCancellationRequested(() => {
            clearTimeout(handle);
        });
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
