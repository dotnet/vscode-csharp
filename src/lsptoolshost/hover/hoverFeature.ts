/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ClientCapabilities, FeatureState, StaticFeature, ensure } from 'vscode-languageclient';

export class HoverFeature implements StaticFeature {
    public fillClientCapabilities(capabilities: ClientCapabilities): void {
        const textDocument = ensure(capabilities, 'textDocument')!;
        const hover = ensure(textDocument, 'hover')!;

        // Opt declaration blocks into the C# TextMate hover grammar without changing documentation examples.
        Object.assign(hover, { _roslyn_supportsCSharpDeclarationMarkers: true });
    }

    public initialize(): void {}

    public clear(): void {}

    public getState(): FeatureState {
        return { kind: 'static' };
    }
}
