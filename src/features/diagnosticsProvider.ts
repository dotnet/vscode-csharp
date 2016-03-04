/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {OmnisharpServer} from '../omnisharpServer';
import AbstractSupport from './abstractProvider';
import * as proto from '../protocol';
import {toRange} from '../typeConvertion';
import * as vscode from 'vscode';

export class Advisor {

	private _disposable: vscode.Disposable;
	private _server: OmnisharpServer;
	private _packageRestoreCounter: number = 0;
	private _projectSourceFileCounts: { [path: string]: number } = Object.create(null);

	constructor(server: OmnisharpServer) {
		this._server = server;
		let d1 = server.onProjectChange(this._onProjectChange, this);
		let d2 = server.onBeforePackageRestore(this._onBeforePackageRestore, this);
		let d3 = server.onPackageRestore(this._onPackageRestore, this);
		this._disposable = vscode.Disposable.from(d1, d2, d3);
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

	private _onProjectChange(info: proto.ProjectInformationResponse): void {
		if (info.DnxProject && info.DnxProject.SourceFiles) {
			this._projectSourceFileCounts[info.DnxProject.Path] = info.DnxProject.SourceFiles.length;
		}
		
		if (info.MsBuildProject && info.MsBuildProject.SourceFiles) {
			this._projectSourceFileCounts[info.MsBuildProject.Path] = info.MsBuildProject.SourceFiles.length;
		}
	}

	private _onBeforePackageRestore(): void {
		this._packageRestoreCounter += 1;
	}

	private _onPackageRestore(): void {
		this._packageRestoreCounter -= 1;
	}

	private _isServerStarted(): boolean {
		return this._server.isRunning();
	}

	private _isRestoringPackages(): boolean {
		return this._packageRestoreCounter > 0;
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

export default function reportDiagnostics(server: OmnisharpServer, advisor: Advisor): vscode.Disposable {
	return new DiagnosticsProvider(server, advisor);
}

class DiagnosticsProvider extends AbstractSupport {

	private _validationAdvisor: Advisor;
	private _disposable: vscode.Disposable;
	private _documentValidations: { [uri: string]: vscode.CancellationTokenSource } = Object.create(null);
	private _projectValidation: vscode.CancellationTokenSource;
	private _diagnostics: vscode.DiagnosticCollection;

	constructor(server: OmnisharpServer, validationAdvisor: Advisor) {
		super(server);
		this._validationAdvisor = validationAdvisor;
		this._diagnostics = vscode.languages.createDiagnosticCollection('omnisharp');

		let d1 = this._server.onPackageRestore(this._validateProject, this);
		let d2 = this._server.onProjectChange(this._validateProject, this);
		let d4 = vscode.workspace.onDidOpenTextDocument(event => this._onDocumentAddOrChange(event), this);
		let d3 = vscode.workspace.onDidChangeTextDocument(event => this._onDocumentAddOrChange(event.document), this);
		let d5 = vscode.workspace.onDidCloseTextDocument(this._onDocumentRemove, this);
		this._disposable = vscode.Disposable.from(this._diagnostics, d1, d2, d3, d4, d5);
	}

	public dispose(): void {
		if (this._projectValidation) {
			this._projectValidation.dispose();
		}
		
		for (let key in this._documentValidations) {
			this._documentValidations[key].dispose();
		}
		
		this._disposable.dispose();
	}

	private _onDocumentAddOrChange(document: vscode.TextDocument): void {
		if (document.languageId === 'csharp' && document.uri.scheme === 'file') {
			this._validateDocument(document);
			this._validateProject();
		}
	}

	private _onDocumentRemove(document: vscode.TextDocument) {
		let key = document.uri.toString();
		let didChange = false;
		if (this._diagnostics[key]) {
			didChange = true;
			this._diagnostics[key].dispose();
			delete this._diagnostics[key];
		}
		
		if (this._documentValidations[key]) {
			didChange = true;
			this._documentValidations[key].cancel();
			delete this._documentValidations[key];
		}
		
		if (didChange) {
			this._validateProject();
		}
	}

	private _validateDocument(document: vscode.TextDocument): void {

		if (!this._validationAdvisor.shouldValidateFiles()) {
			return;
		}

		let key = document.uri.toString();
		if (this._documentValidations[key]) {
			this._documentValidations[key].cancel();
		}

		let source = new vscode.CancellationTokenSource();
		let handle = setTimeout(() => {
			let req: proto.Request = { Filename: document.fileName };
			this._server.makeRequest<proto.QuickFixResponse>(proto.CodeCheck, req, source.token).then(value => {

				// (re)set new diagnostics for this document
				let diagnostics = value.QuickFixes.map(DiagnosticsProvider._asDiagnostic);
				this._diagnostics.set(document.uri, diagnostics);
			});
		}, 750);

		source.token.onCancellationRequested(() => clearTimeout(handle));
		this._documentValidations[key] = source;
	}

	private _validateProject(): void {

		if (!this._validationAdvisor.shouldValidateProject()) {
			return;
		}

		if (this._projectValidation) {
			this._projectValidation.cancel();
		}

		this._projectValidation = new vscode.CancellationTokenSource();
		let handle = setTimeout(() => {
			this._server.makeRequest<proto.QuickFixResponse>(proto.CodeCheck, {}, this._projectValidation.token).then(value => {

				let quickFixes = value.QuickFixes.sort((a, b) => a.FileName.localeCompare(b.FileName));
				let entries: [vscode.Uri, vscode.Diagnostic[]][] = [];
				let lastEntry: [vscode.Uri, vscode.Diagnostic[]];

				for (let quickFix of quickFixes) {

					let diag = DiagnosticsProvider._asDiagnostic(quickFix);
					let uri = vscode.Uri.file(quickFix.FileName);

					if (lastEntry && lastEntry[0].toString() === uri.toString()) {
						lastEntry[1].push(diag);
					}
					else {
						lastEntry = [uri, [diag]];
						entries.push(lastEntry);
					}
				}

				// replace all entries
				this._diagnostics.set(entries);
			});
		}, 3000);

		// clear timeout on cancellation
		this._projectValidation.token.onCancellationRequested(() => {
			clearTimeout(handle);
		});
	}

	// --- data converter

	private static _asDiagnostic(quickFix: proto.QuickFix): vscode.Diagnostic {
		let severity = DiagnosticsProvider._asDiagnosticSeverity(quickFix.LogLevel);
		let message = `${quickFix.Text} [${quickFix.Projects.map(n => DiagnosticsProvider._asProjectLabel(n)).join(', ') }]`;
		
		return new vscode.Diagnostic(toRange(quickFix), message, severity);
	}

	private static _asDiagnosticSeverity(logLevel: string): vscode.DiagnosticSeverity {
		switch (logLevel.toLowerCase()) {
			case 'hidden':
			case 'warning':
			case 'warn':
				return vscode.DiagnosticSeverity.Warning;
				
			default:
				return vscode.DiagnosticSeverity.Error;
		}
	}

	private static _asProjectLabel(projectName: string): string {
		const idx = projectName.indexOf('+');
		return projectName.substr(idx + 1);
	}
}
