/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import * as vscode from 'vscode';

import Structure = protocol.V2.Structure;
import OmnisharpSymbolKind = protocol.V2.OmnisharpSymbolKind;
import SymbolRangeNames = protocol.V2.SymbolRangeNames;
import { toRange3 } from '../omnisharp/typeConversion';

export default class OmnisharpDocumentSymbolProvider extends AbstractSupport implements vscode.DocumentSymbolProvider {

    async provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.DocumentSymbol[]> {
        try {
            const response = await serverUtils.codeStructure(this._server, { FileName: document.fileName }, token);

            if (response && response.Elements) {
                return createSymbols(response.Elements);
            }

            return [];
        }
        catch (error) {
            return [];
        }
    }
}

function createSymbols(elements: Structure.CodeElement[]): vscode.DocumentSymbol[] {
    let results: vscode.DocumentSymbol[] = [];

    elements.forEach(element => {
        let symbol = createSymbolForElement(element);
        if (element.Children) {
            symbol.children = createSymbols(element.Children);
        }

        results.push(symbol);
    });

    return results;
}

function createSymbolForElement(element: Structure.CodeElement): vscode.DocumentSymbol {
    const fullRange = element.Ranges[SymbolRangeNames.Full];
    const nameRange = element.Ranges[SymbolRangeNames.Name];

    return new vscode.DocumentSymbol(element.DisplayName, /*detail*/ "", toSymbolKind(element.Kind), toRange3(fullRange), toRange3(nameRange));
}

const kinds: { [kind: string]: vscode.SymbolKind; } = {};

kinds[OmnisharpSymbolKind.Array] = vscode.SymbolKind.Array;
kinds[OmnisharpSymbolKind.Class] = vscode.SymbolKind.Class;
kinds[OmnisharpSymbolKind.Delegate] = vscode.SymbolKind.Class;
kinds[OmnisharpSymbolKind.Enum] = vscode.SymbolKind.Enum;
kinds[OmnisharpSymbolKind.Interface] = vscode.SymbolKind.Interface;
kinds[OmnisharpSymbolKind.Struct] = vscode.SymbolKind.Struct;
kinds[OmnisharpSymbolKind.TypeParameter] = vscode.SymbolKind.TypeParameter;

kinds[OmnisharpSymbolKind.Constant] = vscode.SymbolKind.Constant;
kinds[OmnisharpSymbolKind.Destructor] = vscode.SymbolKind.Method;
kinds[OmnisharpSymbolKind.EnumMember] = vscode.SymbolKind.EnumMember;
kinds[OmnisharpSymbolKind.Event] = vscode.SymbolKind.Event;
kinds[OmnisharpSymbolKind.Field] = vscode.SymbolKind.Field;
kinds[OmnisharpSymbolKind.Indexer] = vscode.SymbolKind.Property;
kinds[OmnisharpSymbolKind.Method] = vscode.SymbolKind.Method;
kinds[OmnisharpSymbolKind.Operator] = vscode.SymbolKind.Operator;
kinds[OmnisharpSymbolKind.Property] = vscode.SymbolKind.Property;

kinds[OmnisharpSymbolKind.Namespace] = vscode.SymbolKind.Namespace;
kinds[OmnisharpSymbolKind.Unknown] = vscode.SymbolKind.Class;

function toSymbolKind(kind: string): vscode.SymbolKind {
    // Note: 'constructor' is a special property name for JavaScript objects.
    // So, we need to handle it specifically.
    if (kind === 'constructor') {
        return vscode.SymbolKind.Constructor;
    }

    return kinds[kind];
}
