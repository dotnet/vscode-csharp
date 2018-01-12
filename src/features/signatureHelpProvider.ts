/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import AbstractSupport from './abstractProvider';
import * as serverUtils from '../omnisharp/utils';
import { createRequest } from '../omnisharp/typeConvertion';
import { SignatureHelpProvider, SignatureHelp, SignatureInformation, ParameterInformation, CancellationToken, TextDocument, Position } from 'vscode';
import { MarkdownString } from 'vscode';
import { SignatureHelpParameter } from '../omnisharp/protocol';

export default class OmniSharpSignatureHelpProvider extends AbstractSupport implements SignatureHelpProvider {

    public provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken): Promise<SignatureHelp> {

        let req = createRequest(document, position);

        return serverUtils.signatureHelp(this._server, req, token).then(res => {

            if (!res) {
                return undefined;
            }

            let ret = new SignatureHelp();
            ret.activeSignature = res.ActiveSignature;
            ret.activeParameter = res.ActiveParameter;

            for (let signature of res.Signatures) {

                let signatureInfo = new SignatureInformation(signature.Label, signature.StructuredDocumentation.SummaryText);
                ret.signatures.push(signatureInfo);

                for (let parameter of signature.Parameters) {
                    let parameterInfo = new ParameterInformation(
                        parameter.Label,
                        this.GetParameterDocumentation(parameter));

                    signatureInfo.parameters.push(parameterInfo);
                }
            }

            return ret;
        });
    }

    private GetParameterDocumentation(parameter: SignatureHelpParameter) {
        let summary = parameter.Documentation;
        if (summary.length > 0) {
            let nameInBold = `**${parameter.Name}**: `;
            return new MarkdownString(nameInBold + summary);
        }

        return "";
    }
}
