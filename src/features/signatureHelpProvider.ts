/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as serverUtils from '../omnisharp/utils';
import { createRequest } from '../omnisharp/typeConversion';
import { SignatureHelpProvider, SignatureHelp, SignatureInformation, ParameterInformation, CancellationToken, TextDocument, Position } from 'vscode';
import { MarkdownString } from 'vscode';
import { SignatureHelpParameter } from '../omnisharp/protocol';

export default class OmniSharpSignatureHelpProvider extends AbstractSupport implements SignatureHelpProvider {

    public async provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken): Promise<SignatureHelp> {

        let req = createRequest(document, position);

        try {
            let res = await serverUtils.signatureHelp(this._server, req, token);

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
        }
        catch (error) {
            return undefined;
        }
    }

    private GetParameterDocumentation(parameter: SignatureHelpParameter) {
        let summary = parameter.Documentation;
        if (summary.length > 0) {
            let paramText = `**${parameter.Name}**: ${summary}`;
            return new MarkdownString(paramText);
        }

        return "";
    }
}
