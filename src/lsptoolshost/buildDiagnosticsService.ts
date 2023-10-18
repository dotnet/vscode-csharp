/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

export enum AnalysisSetting {
    FullSolution = 'fullSolution',
    OpenFiles = 'openFiles',
    None = 'none',
}

export class BuildDiagnosticsService {
    /** All the build results sent by the DevKit extension. */
    private _allBuildDiagnostics: Array<[vscode.Uri, vscode.Diagnostic[]]> = [];

    /** The diagnostic results from build displayed by VS Code. When live diagnostics are available for a file, these are errors that only build knows about.
     * When live diagnostics aren't loaded for a file, then these are all of the diagnostics reported by the build.*/
    private _diagnosticsReportedByBuild: vscode.DiagnosticCollection;

    constructor(buildDiagnostics: vscode.DiagnosticCollection) {
        this._diagnosticsReportedByBuild = buildDiagnostics;
    }

    public clearDiagnostics() {
        this._diagnosticsReportedByBuild.clear();
    }

    public async setBuildDiagnostics(
        buildDiagnostics: Array<[vscode.Uri, vscode.Diagnostic[]]>,
        buildOnlyIds: string[]
    ) {
        this._allBuildDiagnostics = buildDiagnostics;
        const displayedBuildDiagnostics = new Array<[vscode.Uri, vscode.Diagnostic[]]>();
        const allDocuments = vscode.workspace.textDocuments;

        this._allBuildDiagnostics.forEach((fileDiagnostics) => {
            const uri = fileDiagnostics[0];
            const diagnosticList = fileDiagnostics[1];

            // Check if the document is open
            const document = allDocuments.find((d) => this.compareUri(d.uri, uri));
            const isDocumentOpen = document !== undefined ? !document.isClosed : false;

            // Show the build-only diagnostics
            displayedBuildDiagnostics.push([
                uri,
                BuildDiagnosticsService.filerDiagnosticsFromBuild(diagnosticList, buildOnlyIds, isDocumentOpen),
            ]);
        });

        this._diagnosticsReportedByBuild.set(displayedBuildDiagnostics);
    }

    private compareUri(a: vscode.Uri, b: vscode.Uri): boolean {
        return a.path.localeCompare(b.path, undefined, { sensitivity: 'accent' }) === 0;
    }

    public async _onFileOpened(document: vscode.TextDocument, buildOnlyIds: string[]) {
        const uri = document.uri;
        const currentFileBuildDiagnostics = this._allBuildDiagnostics?.find(([u]) => this.compareUri(u, uri));

        // The document is now open in the editor and live diagnostics are being shown. Filter diagnostics
        // reported by the build to show build-only problems.
        if (currentFileBuildDiagnostics) {
            const buildDiagnostics = BuildDiagnosticsService.filerDiagnosticsFromBuild(
                currentFileBuildDiagnostics[1],
                buildOnlyIds,
                true
            );
            this._diagnosticsReportedByBuild.set(uri, buildDiagnostics);
        }
    }

    public static filerDiagnosticsFromBuild(
        diagnosticList: vscode.Diagnostic[],
        buildOnlyIds: string[],
        isDocumentOpen: boolean
    ): vscode.Diagnostic[] {
        const configuration = vscode.workspace.getConfiguration();
        const analyzerDiagnosticScope = configuration.get(
            'dotnet.backgroundAnalysis.analyzerDiagnosticsScope'
        ) as AnalysisSetting;
        const compilerDiagnosticScope = configuration.get(
            'dotnet.backgroundAnalysis.compilerDiagnosticsScope'
        ) as AnalysisSetting;

        // If compiler and analyzer diagnostics are set to "none", show everything reported by the build
        if (analyzerDiagnosticScope === AnalysisSetting.None && compilerDiagnosticScope === AnalysisSetting.None) {
            return diagnosticList;
        }

        // Filter the diagnostics reported by the build. Some may already be shown by live diagnostics.
        const buildOnlyDiagnostics: vscode.Diagnostic[] = [];
        diagnosticList.forEach((d) => {
            if (d.code) {
                // If it is a "build-only"diagnostics (e.g. it can only be found by building)
                // the diagnostic will always be included
                if (buildOnlyIds.find((b_id) => b_id === d.code)) {
                    buildOnlyDiagnostics.push(d);
                } else {
                    const isAnalyzerDiagnostic = BuildDiagnosticsService.isAnalyzerDiagnostic(d);
                    const isCompilerDiagnostic = BuildDiagnosticsService.isCompilerDiagnostic(d);

                    if (
                        (isAnalyzerDiagnostic && analyzerDiagnosticScope === AnalysisSetting.None) ||
                        (isCompilerDiagnostic && compilerDiagnosticScope === AnalysisSetting.None)
                    ) {
                        // If live diagnostics are completely turned off for this type, then show the build diagnostic
                        buildOnlyDiagnostics.push(d);
                    } else if (isDocumentOpen) {
                        // no-op. The document is open and live diagnostis are on. This diagnostic is already being shown.
                    } else if (
                        (isAnalyzerDiagnostic && analyzerDiagnosticScope === AnalysisSetting.FullSolution) ||
                        (isCompilerDiagnostic && compilerDiagnosticScope === AnalysisSetting.FullSolution)
                    ) {
                        // no-op. Full solution analysis is on for this diagnostic type. All diagnostics are already being shown.
                    } else {
                        // The document is closed, and the analysis setting is to only show for open files.
                        // Show the diagnostic reported by build.
                        buildOnlyDiagnostics.push(d);
                    }
                }
            }
        });

        return buildOnlyDiagnostics;
    }

    private static isCompilerDiagnostic(d: vscode.Diagnostic): boolean {
        return d.code ? d.code.toString().startsWith('CS') : false;
    }

    private static isAnalyzerDiagnostic(d: vscode.Diagnostic): boolean {
        return d.code ? !d.code.toString().startsWith('CS') : false;
    }
}
