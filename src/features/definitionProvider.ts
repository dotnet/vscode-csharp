/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import AbstractSupport from './abstractProvider';
import * as serverUtils from '../omnisharpUtils';
import {createRequest, toLocation} from '../typeConvertion';
import {TextDocument, Position, Location, CancellationToken, DefinitionProvider} from 'vscode';

export default class CSharpDefinitionProvider extends AbstractSupport implements DefinitionProvider {

	public provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Location> {

		let req = createRequest(document, position);

		return serverUtils.goToDefinition(this._server, req, token).then(value => {
			if (value && value.FileName) {
				return toLocation(value);
			}
		});
	}
}
