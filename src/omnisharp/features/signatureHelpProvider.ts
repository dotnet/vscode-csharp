/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as serverUtils from '../utils';
import { createRequest } from '../typeConversion';
import {
    SignatureHelpProvider,
    SignatureHelp,
    SignatureInformation,
    ParameterInformation,
    CancellationToken,
    TextDocument,
    Position,
} from 'vscode';
import { MarkdownString } from 'vscode';
import { SignatureHelpParameter } from '../protocol';

export default class OmniSharpSignatureHelpProvider extends AbstractSupport implements SignatureHelpProvider {
    public async provideSignatureHelp(
        document: TextDocument,
        position: Position,
        token: CancellationToken
    ): Promise<SignatureHelp | undefined> {
        const req = createRequest(document, position);

        try {
            const res = await serverUtils.signatureHelp(this._server, req, token);

            if (!res) {
                return undefined;
            }

            const ret = new SignatureHelp();
            ret.activeSignature = res.ActiveSignature;
            ret.activeParameter = res.ActiveParameter;

            for (const signature of res.Signatures) {
                const signatureInfo = new SignatureInformation(
                    signature.Label,
                    signature.StructuredDocumentation.SummaryText
                );
                ret.signatures.push(signatureInfo);

                for (const parameter of signature.Parameters) {
                    const parameterInfo = new ParameterInformation(
                        parameter.Label,
                        this.GetParameterDocumentation(parameter)
                    );

                    signatureInfo.parameters.push(parameterInfo);
                }
            }

            return ret;
        } catch (error) {
            return undefined;
        }
    }

    private GetParameterDocumentation(parameter: SignatureHelpParameter) {
        const summary = parameter.Documentation;
        if (summary.length > 0) {
            const paramText = `**${parameter.Name}**: ${summary}`;
            return new MarkdownString(paramText);
        }

        return '';
    }
}
