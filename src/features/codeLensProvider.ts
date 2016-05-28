/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {CancellationToken, CodeLens, Range, Uri, TextDocument, CodeLensProvider} from 'vscode';
import {toRange, toLocation} from '../typeConvertion';
import AbstractSupport from './abstractProvider';
import {updateCodeLensForTest} from './dotnetTest';
import * as protocol from '../protocol';
import * as serverUtils from '../omnisharpUtils';

class OmniSharpCodeLens extends CodeLens {

    fileName: string;

    constructor(fileName: string, range: Range) {
        super(range);
        this.fileName = fileName;
    }
}

export default class OmniSharpCodeLensProvider extends AbstractSupport implements CodeLensProvider {

    private static filteredSymbolNames: { [name: string]: boolean } = {
        'Equals': true,
        'Finalize': true,
        'GetHashCode': true,
        'ToString': true
    };

    provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] | Thenable<CodeLens[]> {
        let request = { Filename: document.fileName };
        return serverUtils.currentFileMembersAsTree(this._server, { Filename: document.fileName }, token).then(tree => {
            let ret: CodeLens[] = [];
            tree.TopLevelTypeDefinitions.forEach(node => this._convertQuickFix(ret, document.fileName, node));
            return ret;
        });
    }

    private _convertQuickFix(bucket: CodeLens[], fileName: string, node: protocol.Node): void {

        if (node.Kind === 'MethodDeclaration' && OmniSharpCodeLensProvider.filteredSymbolNames[node.Location.Text]) {
            return;
        }

        let lens = new OmniSharpCodeLens(fileName, toRange(node.Location));
        bucket.push(lens);

        for (let child of node.ChildNodes) {
            this._convertQuickFix(bucket, fileName, child);
        }

        updateCodeLensForTest(bucket, fileName, node, this._server.isDebugEnable());
    }

    resolveCodeLens(codeLens: CodeLens, token: CancellationToken): Thenable<CodeLens> {
        if (codeLens instanceof OmniSharpCodeLens) {

            let req = <protocol.FindUsagesRequest>{
                Filename: codeLens.fileName,
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
                    arguments: [Uri.file(req.Filename), codeLens.range.start, res.QuickFixes.map(toLocation)]
                };

                return codeLens;
            });
        }
    }
}
