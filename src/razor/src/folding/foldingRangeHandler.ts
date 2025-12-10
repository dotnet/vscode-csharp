/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver-protocol';
import { RazorLogger } from '../razorLogger';

export class FoldingRangeHandler {
    constructor() {}

    public static convertFoldingRanges(foldingRanges: vscode.FoldingRange[], logger: RazorLogger) {
        const convertedFoldingRanges = new Array<FoldingRange>();
        foldingRanges.forEach((foldingRange) => {
            const convertedFoldingRange: FoldingRange = {
                startLine: foldingRange.start,
                startCharacter: 0,
                endLine: foldingRange.end,
                endCharacter: 0,
                kind:
                    foldingRange.kind === undefined
                        ? undefined
                        : FoldingRangeHandler.convertFoldingRangeKind(foldingRange.kind, logger),
            };

            convertedFoldingRanges.push(convertedFoldingRange);
        });

        return convertedFoldingRanges;
    }

    private static convertFoldingRangeKind(kind: vscode.FoldingRangeKind, logger: RazorLogger) {
        if (kind === vscode.FoldingRangeKind.Comment) {
            return FoldingRangeKind.Comment;
        } else if (kind === vscode.FoldingRangeKind.Imports) {
            return FoldingRangeKind.Imports;
        } else if (kind === vscode.FoldingRangeKind.Region) {
            return FoldingRangeKind.Region;
        } else {
            logger.logWarning(`Unexpected FoldingRangeKind ${kind}`);
            return undefined;
        }
    }
}
