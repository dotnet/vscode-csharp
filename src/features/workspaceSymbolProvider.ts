/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import { OmniSharpServer } from '../omnisharp/server';
import OptionProvider from '../observers/OptionProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { toRange } from '../omnisharp/typeConversion';
import { CancellationToken, Uri, WorkspaceSymbolProvider, SymbolInformation, SymbolKind } from 'vscode';
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';


export default class OmnisharpWorkspaceSymbolProvider extends AbstractSupport implements WorkspaceSymbolProvider {

    constructor(server: OmniSharpServer, private optionProvider: OptionProvider, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
    }

    public async provideWorkspaceSymbols(search: string, token: CancellationToken): Promise<SymbolInformation[]> {

        let options = this.optionProvider.GetLatestOptions();
        let minFilterLength = options.minFindSymbolsFilterLength > 0 ? options.minFindSymbolsFilterLength : undefined;
        let maxItemsToReturn = options.maxFindSymbolsItems > 0 ? options.maxFindSymbolsItems : undefined;

        if (minFilterLength != undefined && search.length < minFilterLength) {
            return [];
        }

        try {
            let res = await serverUtils.findSymbols(this._server, { Filter: search, MaxItemsToReturn: maxItemsToReturn, FileName: '' }, token);
            if (res && Array.isArray(res.QuickFixes)) {
                return res.QuickFixes.map(OmnisharpWorkspaceSymbolProvider._asSymbolInformation);
            }
        }
        catch (error) {
            return [];
        }
    }

    private static _asSymbolInformation(symbolInfo: protocol.SymbolLocation): SymbolInformation {

        return new SymbolInformation(symbolInfo.Text, OmnisharpWorkspaceSymbolProvider._toKind(symbolInfo),
            toRange(symbolInfo),
            Uri.file(symbolInfo.FileName));
    }

    private static _toKind(symbolInfo: protocol.SymbolLocation): SymbolKind {
        switch (symbolInfo.Kind) {
            case 'Method':
                return SymbolKind.Method;
            case 'Field':
                return SymbolKind.Field;
            case 'Property':
                return SymbolKind.Property;
            case 'Interface':
                return SymbolKind.Interface;
            case 'Enum':
                return SymbolKind.Enum;
            case 'Struct':
                return SymbolKind.Struct;
            case 'Event':
                return SymbolKind.Event;
            case 'EnumMember':
                return SymbolKind.EnumMember;
            case 'Class':
                return SymbolKind.Class;
            default:
                return SymbolKind.Class;

        }
    }
}
