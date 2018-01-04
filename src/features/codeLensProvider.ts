/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import * as vscode from 'vscode';

import { toLocation, toRange } from '../omnisharp/typeConvertion';

import AbstractProvider from './abstractProvider';
import { OmniSharpServer } from '../omnisharp/server';
import { Options } from '../omnisharp/options';
import TelemetryReporter from 'vscode-extension-telemetry';
import TestManager from './dotnetTest';
import { Range } from 'vscode';

class OmniSharpCodeLens extends vscode.CodeLens {

    fileName: string;
    actualRange: vscode.Range;

    constructor(fileName: string, actualRange: vscode.Range, attributeRange: vscode.Range) {
        super(attributeRange);
        this.fileName = fileName;
        this.actualRange = actualRange;
    }
}

export default class OmniSharpCodeLensProvider extends AbstractProvider implements vscode.CodeLensProvider {

    private _options: Options;

    constructor(server: OmniSharpServer, reporter: TelemetryReporter, testManager: TestManager) {
        super(server, reporter);

        this._resetCachedOptions();

        let configChangedDisposable = vscode.workspace.onDidChangeConfiguration(this._resetCachedOptions, this);
        this.addDisposables(configChangedDisposable);
    }

    private _resetCachedOptions(): void {
        this._options = Options.Read();
    }

    private static filteredSymbolNames: { [name: string]: boolean } = {
        'Equals': true,
        'Finalize': true,
        'GetHashCode': true,
        'ToString': true
    };

    async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken){
        if (!this._options.showReferencesCodeLens && !this._options.showTestsCodeLens) {
            return [];
        }

        let tree = await serverUtils.currentFileMembersAsTree(this._server, { FileName: document.fileName }, token);
        let ret: vscode.CodeLens[] = [];
        tree.TopLevelTypeDefinitions.forEach(node => this._convertQuickFix(ret, document, node));
        return ret;
    }

    private _convertQuickFix(bucket: vscode.CodeLens[], document: vscode.TextDocument, node: protocol.Node): void {

        if (node.Kind === 'MethodDeclaration' && OmniSharpCodeLensProvider.filteredSymbolNames[node.Location.Text]) {
            return;
        }

        let attributeRange = this._attributeSpanToRange(document, node);
        let lens = new OmniSharpCodeLens(document.fileName, toRange(node.Location), attributeRange);
        if (this._options.showReferencesCodeLens) {
            bucket.push(lens);
        }

        for (let child of node.ChildNodes) {
            this._convertQuickFix(bucket, document, child);
        }

        if (this._options.showTestsCodeLens) {
            this._updateCodeLensForTest(bucket, document.fileName, node, attributeRange);
        }
    }

    resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): Thenable<vscode.CodeLens> {
        if (codeLens instanceof OmniSharpCodeLens) {

            let req = <protocol.FindUsagesRequest>{
                FileName: codeLens.fileName,
                Line: codeLens.actualRange.start.line + 1,
                Column: codeLens.actualRange.start.character + 1,
                OnlyThisFile: false,
                ExcludeDefinition: true
            };

            return serverUtils.findUsages(this._server, req, token).then(res => {
                if (!res || !Array.isArray(res.QuickFixes)) {
                    return;
                }

                let len = res.QuickFixes.length;
                codeLens.command = {
                    title: len === 1 ? '1 reference' : `${len} references`,
                    command: 'editor.action.showReferences',
                    arguments: [vscode.Uri.file(req.FileName), codeLens.actualRange.start, res.QuickFixes.map(toLocation)]
                };

                return codeLens;
            });
        }
    }

    private _updateCodeLensForTest(bucket: vscode.CodeLens[], fileName: string, node: protocol.Node, attributeRange: vscode.Range) {
        // backward compatible check: Features property doesn't present on older version OmniSharp
        if (node.Features === undefined) {
            return;
        }

        let testFeature = node.Features.find(value => (value.Name == 'XunitTestMethod' || value.Name == 'NUnitTestMethod' || value.Name == 'MSTestMethod'));
        if (testFeature) {
            // this test method has a test feature
            let testFrameworkName = 'xunit';
            if (testFeature.Name == 'NUnitTestMethod') {
                testFrameworkName = 'nunit';
            }
            else if (testFeature.Name == 'MSTestMethod') {
                testFrameworkName = 'mstest';
            }

            bucket.push(new vscode.CodeLens(
                attributeRange,
                { title: "run test", command: 'dotnet.test.run', arguments: [testFeature.Data, fileName, testFrameworkName] }));

            bucket.push(new vscode.CodeLens(
                attributeRange,
                { title: "debug test", command: 'dotnet.test.debug', arguments: [testFeature.Data, fileName, testFrameworkName] }));
        }
    }

    private _attributeSpanToRange(document: vscode.TextDocument, node: protocol.Node): vscode.Range {
        //If the node has some attributes then returns the range of the attributes, else returns the range from the actual node location
        if (node.AttributeSpanStart) {
            let start = document.positionAt(node.AttributeSpanStart);
            let end = document.positionAt(node.AttributeSpanEnd);
            return new Range(start,end);
        }
        return toRange(node.Location);
    }
}
