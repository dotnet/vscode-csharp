/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {extractSummaryText} from './documentation';
import AbstractSupport from './abstractProvider';
import * as protocol from '../protocol';
import * as serverUtils from '../omnisharpUtils';
import {createRequest} from '../typeConvertion';
import {HoverProvider, Hover, TextDocument, CancellationToken, Position} from 'vscode';

export default class OmniSharpHoverProvider extends AbstractSupport implements HoverProvider {

	public provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover> {

		let req = createRequest<protocol.TypeLookupRequest>(document, position);
		req.IncludeDocumentation = true;

		return serverUtils.typeLookup(this._server, req, token).then(value => {
			if (value && value.Type) {
				let contents = [extractSummaryText(value.Documentation), { language: 'csharp', value: value.Type }];
				return new Hover(contents);
			}
		});
	}
}
