/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CancellationToken, InlineValue, InlineValueContext, InlineValueEvaluatableExpression, InlineValuesProvider, InlineValueText, InlineValueVariableLookup, Range, TextDocument } from "vscode";
import { LanguageMiddlewareFeature } from "../omnisharp/LanguageMiddlewareFeature";
import { OmniSharpServer } from "../omnisharp/server";
import * as serverUtils from '../omnisharp/utils';
import * as typeConversion from '../omnisharp/typeConversion';
import AbstractProvider from "./abstractProvider";
import { InlineValueKind } from "../omnisharp/protocol";

export default class CSharpInlineValuesProvider extends AbstractProvider implements InlineValuesProvider {
    constructor(server: OmniSharpServer, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
    }
    public async provideInlineValues(document: TextDocument, viewPort: Range, context: InlineValueContext, token: CancellationToken): Promise<InlineValue[]> {
        try {
            const inlineValues = await serverUtils.getInlineValues(this._server, {
                FileName: document.fileName,
                Context: { FrameId: context.frameId, StoppedLocation: typeConversion.toOmnisharpRange(context.stoppedLocation) },
                ViewPort: typeConversion.toOmnisharpRange(viewPort)
            }, token);

            if (!inlineValues.Values) {
                return [];
            }

            const mappedValues = inlineValues.Values.map(value => {
                const vscodeRange = typeConversion.toRange3(value.Range);
                switch (value.Kind) {
                    case InlineValueKind.Text:
                        return new InlineValueText(vscodeRange, value.Text);
                    case InlineValueKind.VariableLookup:
                        return new InlineValueVariableLookup(vscodeRange, value.Text, value.CaseSensitiveLookup);
                    case InlineValueKind.EvaluatableExpression:
                        return new InlineValueEvaluatableExpression(vscodeRange, value.Text);
                    default:
                        throw `Unexpected value ${value.Kind}`;
                }
            });
            return mappedValues;
        }
        catch (e) {
            return;
        }
    }
}
