/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { LanguageKind } from './languageKind';
import { SerializableRange } from './serializableRange';
import { MappingBehavior } from './mappingBehavior';

export class RazorMapToDocumentRangesRequest {
    public readonly razorDocumentUri: string;

    constructor(
        public readonly kind: LanguageKind,
        public readonly projectedRanges: SerializableRange[],
        razorDocumentUri: vscode.Uri,
        public readonly mappingBehavior: MappingBehavior
    ) {
        this.razorDocumentUri = razorDocumentUri.toString();
    }
}
