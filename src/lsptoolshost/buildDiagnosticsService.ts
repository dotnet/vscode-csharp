/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { languageServerOptions } from '../shared/options';

export enum AnalysisSetting {
    FullSolution = 'fullSolution',
    OpenFiles = 'openFiles',
    None = 'none',
}

export class BuildDiagnosticsService {
    /** All the build results sent by the DevKit extension. */
    private _allBuildDiagnostics: { [uri: string]: vscode.Diagnostic[] } = {};

    /** The diagnostic results from build displayed by VS Code. When live diagnostics are available for a file, these are errors that only build knows about.
     * When live diagnostics aren't loaded for a file, then these are all of the diagnostics reported by the build.*/
    private _diagnosticsReportedByBuild: vscode.DiagnosticCollection;

    constructor(buildDiagnostics: vscode.DiagnosticCollection) {
        this._diagnosticsReportedByBuild = buildDiagnostics;
    }

    public clearDiagnostics() {
        this._diagnosticsReportedByBuild.clear();
    }

    public async setBuildDiagnostics(buildDiagnostics: { [uri: string]: vscode.Diagnostic[] }, buildOnlyIds: string[]) {
        this._allBuildDiagnostics = buildDiagnostics;
        const displayedBuildDiagnostics = new Array<[vscode.Uri, vscode.Diagnostic[]]>();
        const allDocuments = vscode.workspace.textDocuments;

        for (const [uriPath, diagnosticList] of Object.entries(this._allBuildDiagnostics)) {
            // Check if the document is open
            const uri = vscode.Uri.file(uriPath);
            const document = allDocuments.find((d) => this.compareUri(d.uri, uri));
            const isDocumentOpen = document !== undefined ? !document.isClosed : false;

            // Show the build-only diagnostics
            displayedBuildDiagnostics.push([
                uri,
                BuildDiagnosticsService.filterDiagnosticsFromBuild(diagnosticList, buildOnlyIds, isDocumentOpen),
            ]);
        }

        this._diagnosticsReportedByBuild.set(displayedBuildDiagnostics);
    }

    private compareUri(a: vscode.Uri, b: vscode.Uri): boolean {
        return a.fsPath.localeCompare(b.fsPath) === 0;
    }

    public async _onFileOpened(document: vscode.TextDocument, buildOnlyIds: string[]) {
        const uri = document.uri;
        const currentFileBuildDiagnostics = this._allBuildDiagnostics[uri.fsPath];

        // The document is now open in the editor and live diagnostics are being shown. Filter diagnostics
        // reported by the build to show build-only problems.
        if (currentFileBuildDiagnostics) {
            const buildDiagnostics = BuildDiagnosticsService.filterDiagnosticsFromBuild(
                currentFileBuildDiagnostics,
                buildOnlyIds,
                true
            );
            this._diagnosticsReportedByBuild.set(uri, buildDiagnostics);
        }
    }

    public static filterDiagnosticsFromBuild(
        diagnosticList: vscode.Diagnostic[],
        buildOnlyIds: string[],
        isDocumentOpen: boolean
    ): vscode.Diagnostic[] {
        const analyzerDiagnosticScope = languageServerOptions.analyzerDiagnosticScope as AnalysisSetting;
        const compilerDiagnosticScope = languageServerOptions.compilerDiagnosticScope as AnalysisSetting;

        // If compiler and analyzer diagnostics are set to "none", show everything reported by the build
        if (analyzerDiagnosticScope === AnalysisSetting.None && compilerDiagnosticScope === AnalysisSetting.None) {
            return diagnosticList;
        }

        // Filter the diagnostics reported by the build. Some may already be shown by live diagnostics.
        const buildDiagnosticsToDisplay: vscode.Diagnostic[] = [];

        // If it is a project system diagnostic (e.g. "Target framework out of support")
        // then always show it. It cannot be reported by live.
        const projectSystemDiagnostics = diagnosticList.filter((d) =>
            BuildDiagnosticsService.isProjectSystemDiagnostic(d)
        );
        buildDiagnosticsToDisplay.push(...projectSystemDiagnostics);

        // If it is a "build-only"diagnostics (i.e. it can only be found by building)
        // then always show it. It cannot be reported by live.
        const buildOnlyDiagnostics = diagnosticList.filter((d) =>
            BuildDiagnosticsService.isBuildOnlyDiagnostic(buildOnlyIds, d)
        );
        buildDiagnosticsToDisplay.push(...buildOnlyDiagnostics);

        // Check the analyzer diagnostic setting. If the setting is "none" or if the file is closed,
        // then no live analyzers are being shown and bulid analyzers should be added.
        // If FSA is on, then this is a no-op as FSA will report all analyzer diagnostics
        if (
            analyzerDiagnosticScope === AnalysisSetting.None ||
            (analyzerDiagnosticScope === AnalysisSetting.OpenFiles && !isDocumentOpen)
        ) {
            const analyzerDiagnostics = diagnosticList.filter(
                // Needs to be analyzer diagnostics and not already reported as "build only"
                (d) => BuildDiagnosticsService.isAnalyzerDiagnostic(d) && !this.isBuildOnlyDiagnostic(buildOnlyIds, d)
            );
            buildDiagnosticsToDisplay.push(...analyzerDiagnostics);
        }

        // Check the compiler diagnostic setting. If the setting is "none" or if the file is closed,
        // then no live compiler diagnostics are being shown and bulid compiler diagnostics should be added.
        // If FSA is on, then this is a no-op as FSA will report all compiler diagnostics
        if (
            compilerDiagnosticScope === AnalysisSetting.None ||
            (compilerDiagnosticScope === AnalysisSetting.OpenFiles && !isDocumentOpen)
        ) {
            const compilerDiagnostics = diagnosticList.filter(
                // Needs to be analyzer diagnostics and not already reported as "build only"
                (d) => BuildDiagnosticsService.isCompilerDiagnostic(d) && !this.isBuildOnlyDiagnostic(buildOnlyIds, d)
            );
            buildDiagnosticsToDisplay.push(...compilerDiagnostics);
        }

        return buildDiagnosticsToDisplay;
    }

    private static isBuildOnlyDiagnostic(buildOnlyIds: string[], d: vscode.Diagnostic): boolean {
        return buildOnlyIds.find((b_id) => b_id === d.code) !== undefined;
    }

    private static isCompilerDiagnostic(d: vscode.Diagnostic): boolean {
        const regex = '[cC][sS][0-9]{4}';
        return d.code ? d.code.toString().match(regex) !== null : false;
    }

    private static isAnalyzerDiagnostic(d: vscode.Diagnostic): boolean {
        return d.code ? !this.isCompilerDiagnostic(d) : false;
    }

    private static isProjectSystemDiagnostic(d: vscode.Diagnostic): boolean {
        return d.code ? d.code.toString().startsWith('NETSDK') : false;
    }
}
