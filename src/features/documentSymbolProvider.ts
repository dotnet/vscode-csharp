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

function createSymbols(elements: Structure.CodeElement[], parentElement?: Structure.CodeElement): vscode.DocumentSymbol[] {
    let results: vscode.DocumentSymbol[] = [];

    elements.forEach(element => {
        let symbol = createSymbolForElement(element, parentElement);
        if (element.Children) {
            symbol.children = createSymbols(element.Children, element);
        }

        results.push(symbol);
    });

    return results;
}

function getNameForElement(element: Structure.CodeElement, parentElement?: Structure.CodeElement): string {
    switch (element.Kind) {
        case SymbolKinds.Class:
        case SymbolKinds.Delegate:
        case SymbolKinds.Enum:
        case SymbolKinds.Interface:
        case SymbolKinds.Struct:
        case SymbolKinds.Namespace:
            if (typeof parentElement === 'undefined')
                return element.DisplayName;
            const prefix = `${parentElement.DisplayName}.`;
            return element.DisplayName.startsWith(prefix) ? element.DisplayName.slice(prefix.length) : element.DisplayName;

        case SymbolKinds.Constant:
        case SymbolKinds.Constructor:
        case SymbolKinds.Destructor:
        case SymbolKinds.EnumMember:
        case SymbolKinds.Event:
        case SymbolKinds.Field:
        case SymbolKinds.Indexer:
        case SymbolKinds.Method:
        case SymbolKinds.Operator:
        case SymbolKinds.Property:
        case SymbolKinds.Unknown:
        default:
            return element.Name;
    }
}

function getNameAndDetailsForElement(element: Structure.CodeElement, parentElement?: Structure.CodeElement): { name: string, details: string } {
    const name = getNameForElement(element, parentElement);
    const details = element.DisplayName === name ? '' : element.DisplayName;

    return { name, details };
}

function createSymbolForElement(element: Structure.CodeElement, parentElement?: Structure.CodeElement): vscode.DocumentSymbol {
    const fullRange = element.Ranges[SymbolRangeNames.Full];
    const nameRange = element.Ranges[SymbolRangeNames.Name];
    const { name, details } = getNameAndDetailsForElement(element, parentElement);

    return new vscode.DocumentSymbol(name, details, toSymbolKind(element.Kind), toRange3(fullRange), toRange3(nameRange));
}

const kinds: { [kind: string]: vscode.SymbolKind; } = {};

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
