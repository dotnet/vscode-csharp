/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as protocol from '../protocol';
import * as serverUtils from '../utils';
import { createRequest } from '../typeConversion';
import { RenameProvider, WorkspaceEdit, TextDocument, Uri, CancellationToken, Position, Range } from 'vscode';

export default class OmniSharpRenameProvider extends AbstractSupport implements RenameProvider {
    public async provideRenameEdits(
        document: TextDocument,
        position: Position,
        newName: string,
        token: CancellationToken
    ): Promise<WorkspaceEdit | undefined> {
        const req = createRequest<protocol.RenameRequest>(document, position);
        req.WantsTextChanges = true;
        req.RenameTo = newName;
        req.ApplyTextChanges = false;

        try {
            const response = await serverUtils.rename(this._server, req, token);

            if (!response) {
                return undefined;
            }

            const edit = new WorkspaceEdit();
            response.Changes.forEach((change) => {
                const uri = Uri.file(change.FileName);

                change.Changes.forEach((change) => {
                    edit.replace(
                        uri,
                        new Range(change.StartLine, change.StartColumn, change.EndLine, change.EndColumn),
                        change.NewText
                    );
                });
            });

            // Allow language middlewares to re-map its edits if necessary.
            const result = await this._languageMiddlewareFeature.remap('remapWorkspaceEdit', edit, token);
            return result;
        } catch (_) {
            return undefined;
        }
    }
}
