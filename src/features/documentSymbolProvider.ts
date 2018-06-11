/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import * as vscode from 'vscode';

import Structure = protocol.V2.Structure;
import SymbolKinds = protocol.V2.SymbolKinds;
import SymbolRangeNames = protocol.V2.SymbolRangeNames;

export default class OmnisharpDocumentSymbolProvider extends AbstractSupport implements vscode.DocumentSymbolProvider {

    async provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SymbolInformation[]> {
        const response = await serverUtils.codeStructure(this._server, { FileName: document.fileName }, token);
        
        if (response && response.Elements) {
            return createSymbols(response.Elements, document.fileName);
        }

        return [];
    }
}

function createSymbols(elements: Structure.CodeElement[], fileName: string): vscode.SymbolInformation[] {
    let results: vscode.SymbolInformation[] = [];

    function walkCodeElements(elements: Structure.CodeElement[], parentElementName?: string): void {
        for (let element of elements) {
            let symbol = createSymbolForElement(element, parentElementName, fileName);

            results.push(symbol);

            if (element.Children) {
                walkCodeElements(element.Children, element.DisplayName);
            }
        }
    }

    walkCodeElements(elements);

    return results;
}

function createSymbolForElement(element: Structure.CodeElement, parentElementName: string, fileName: string): vscode.SymbolInformation {
    const range = element.Ranges[SymbolRangeNames.Full];

    const vscodeRange = new vscode.Range(
        range.Start.Line - 1, range.Start.Column - 1, range.End.Line - 1, range.End.Column - 1
    );

    return new vscode.SymbolInformation(
        element.DisplayName,
        toSymbolKind(element.Kind),
        parentElementName,
        new vscode.Location(vscode.Uri.file(fileName), vscodeRange)
    );
}

const kinds: { [kind: string]: vscode.SymbolKind; } = { };

kinds[SymbolKinds.Class] = vscode.SymbolKind.Class;
kinds[SymbolKinds.Delegate] = vscode.SymbolKind.Class;
kinds[SymbolKinds.Enum] = vscode.SymbolKind.Enum;
kinds[SymbolKinds.Interface] = vscode.SymbolKind.Interface;
kinds[SymbolKinds.Struct] = vscode.SymbolKind.Struct;

kinds[SymbolKinds.Constant] = vscode.SymbolKind.Constant;
kinds[SymbolKinds.Destructor] = vscode.SymbolKind.Method;
kinds[SymbolKinds.EnumMember] = vscode.SymbolKind.EnumMember;
kinds[SymbolKinds.Event] = vscode.SymbolKind.Event;
kinds[SymbolKinds.Field] = vscode.SymbolKind.Field;
kinds[SymbolKinds.Indexer] = vscode.SymbolKind.Property;
kinds[SymbolKinds.Method] = vscode.SymbolKind.Method;
kinds[SymbolKinds.Operator] = vscode.SymbolKind.Operator;
kinds[SymbolKinds.Property] = vscode.SymbolKind.Property;

kinds[SymbolKinds.Namespace] = vscode.SymbolKind.Namespace;
kinds[SymbolKinds.Unknown] = vscode.SymbolKind.Class;

function toSymbolKind(kind: string): vscode.SymbolKind {
    // Note: 'constructor' is a special property name for JavaScript objects.
    // So, we need to handle it specifically.
    if (kind === 'constructor') {
        return vscode.SymbolKind.Constructor;
    }

    return kinds[kind];
}
