/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import AbstractSupport from './abstractProvider';
import * as serverUtils from '../omnisharp/utils';
import {toDocumentSymbol} from '../omnisharp/typeConvertion';
import {DocumentSymbolProvider, SymbolInformation, TextDocument, CancellationToken} from 'vscode';

export default class OmnisharpDocumentSymbolProvider extends AbstractSupport implements DocumentSymbolProvider {

    public provideDocumentSymbols(document: TextDocument, token: CancellationToken): Promise<SymbolInformation[]> {

        return serverUtils.currentFileMembersAsTree(this._server, { FileName: document.fileName }, token).then(tree => {
            let ret: SymbolInformation[] = [];
            for (let node of tree.TopLevelTypeDefinitions) {
                toDocumentSymbol(ret, node);
            }
            return ret;
        });
    }
}
