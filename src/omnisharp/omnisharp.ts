/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Note that this file intentionally does not import 'vscode' as the code within is intended
 * to be usable outside of VS Code. 
 */

'use strict';

import * as path from 'path';

export enum Flavor {
    CoreCLR,
    Mono,
    Desktop
}

export function getInstallDirectory(flavor: Flavor): string {
    const basePath = path.join(__dirname, '../.omnisharp');

    switch (flavor) {
        case Flavor.CoreCLR:
            return basePath + '-coreclr';
        case Flavor.Desktop:
            return basePath + '-desktop';
        case Flavor.Mono:
            return basePath + '-mono';

        default:
            throw new Error(`Unexpected OmniSharp flavor specified: ${flavor}`);
    }
}