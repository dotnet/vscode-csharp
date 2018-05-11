/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import * as vscode from 'vscode';
import { toLocation, toRange } from '../omnisharp/typeConvertion';
import AbstractProvider from './abstractProvider';
import { OmniSharpServer } from '../omnisharp/server';
import { Options } from '../omnisharp/options';
import TestManager from './dotnetTest';
import OptionProvider from '../observers/OptionProvider';

class OmniSharpCodeLens extends vscode.CodeLens {

    fileName: string;

    constructor(fileName: string, range: vscode.Range) {
        super(range);
        this.fileName = fileName;
    }
}

export default class OmniSharpCodeLensProvider extends AbstractProvider implements vscode.CodeLensProvider {

    constructor(server: OmniSharpServer, testManager: TestManager, private optionProvider: OptionProvider) {
        super(server);

    }

    private static filteredSymbolNames: { [name: string]: boolean } = {
        'Equals': true,
        'Finalize': true,
        'GetHashCode': true,
        'ToString': true
    };

    async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken) {
        let options = this.optionProvider.GetLatestOptions();
        if (!options.showReferencesCodeLens && !options.showTestsCodeLens) {
            return [];
        }

        let tree = await serverUtils.currentFileMembersAsTree(this._server, { FileName: document.fileName }, token);
        let ret: vscode.CodeLens[] = [];

        for (let node of tree.TopLevelTypeDefinitions) {
            await this._convertQuickFix(ret, document.fileName, node, options);
        }

        return ret;
    }


    private async _convertQuickFix(bucket: vscode.CodeLens[], fileName: string, node: protocol.Node, options: Options): Promise<void> {

        if (node.Kind === 'MethodDeclaration' && OmniSharpCodeLensProvider.filteredSymbolNames[node.Location.Text]) {
            return;
        }

        let lens = new OmniSharpCodeLens(fileName, toRange(node.Location));
        if (options.showReferencesCodeLens) {
            bucket.push(lens);
        }

        for (let child of node.ChildNodes) {
            this._convertQuickFix(bucket, fileName, child, options);
        }

        if (options.showTestsCodeLens) {
            await this._updateCodeLensForTest(bucket, fileName, node);
        }
    }

    resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): Thenable<vscode.CodeLens> {
        if (codeLens instanceof OmniSharpCodeLens) {

            let req = <protocol.FindUsagesRequest>{
                FileName: codeLens.fileName,
                Line: codeLens.range.start.line + 1,
                Column: codeLens.range.start.character + 1,
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
                    arguments: [vscode.Uri.file(req.FileName), codeLens.range.start, res.QuickFixes.map(toLocation)]
                };

                return codeLens;
            });
        }
    }

    private async  _updateCodeLensForTest(bucket: vscode.CodeLens[], fileName: string, node: protocol.Node): Promise<void> {
        // backward compatible check: Features property doesn't present on older version OmniSharp
        if (node.Features === undefined) {
            return;
        }

        if (node.Kind === "ClassDeclaration" && node.ChildNodes.length > 0) {
            let projectInfo = await serverUtils.requestProjectInformation(this._server, { FileName: fileName });
            if (!projectInfo.DotNetProject && projectInfo.MsBuildProject) {
                this._updateCodeLensForTestClass(bucket, fileName, node);
            }
        }

        let [testFeature, testFrameworkName] = this._getTestFeatureAndFramework(node);
        if (testFeature) {
            bucket.push(new vscode.CodeLens(
                toRange(node.Location),
                { title: "Run Test", command: 'dotnet.test.run', arguments: [testFeature.Data, fileName, testFrameworkName] }));

            bucket.push(new vscode.CodeLens(
                toRange(node.Location),
                { title: "Debug Test", command: 'dotnet.test.debug', arguments: [testFeature.Data, fileName, testFrameworkName] }));
        }
    }

    private _updateCodeLensForTestClass(bucket: vscode.CodeLens[], fileName: string, node: protocol.Node) {
        // if the class doesnot contain any method then return
        if (!node.ChildNodes.find(value => (value.Kind === "MethodDeclaration"))) {
            return;
        }

        let testMethods = new Array<string>();
        let testFrameworkName: string = null;
        for (let child of node.ChildNodes) {
            let [testFeature, frameworkName] = this._getTestFeatureAndFramework(child);
            if (testFeature) {
                // this test method has a test feature
                if (!testFrameworkName) {
                    testFrameworkName = frameworkName;
                }

                testMethods.push(testFeature.Data);
            }
        }

        if (testMethods.length > 0) {
            bucket.push(new vscode.CodeLens(
                toRange(node.Location),
                { title: "Run All Tests", command: 'dotnet.classTests.run', arguments: [testMethods, fileName, testFrameworkName] }));
            bucket.push(new vscode.CodeLens(
                toRange(node.Location),
                { title: "Debug All Tests", command: 'dotnet.classTests.debug', arguments: [testMethods, fileName, testFrameworkName] }));
        }
    }

    private _getTestFeatureAndFramework(node: protocol.Node): [protocol.SyntaxFeature, string] {
        let testFeature = node.Features.find(value => (value.Name == 'XunitTestMethod' || value.Name == 'NUnitTestMethod' || value.Name == 'MSTestMethod'));
        if (testFeature) {
            let testFrameworkName = 'xunit';
            if (testFeature.Name == 'NUnitTestMethod') {
                testFrameworkName = 'nunit';
            }
            else if (testFeature.Name == 'MSTestMethod') {
                testFrameworkName = 'mstest';
            }

            return [testFeature, testFrameworkName];
        }

        return [null, null];
    }
}
