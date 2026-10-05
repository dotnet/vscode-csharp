/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, test } from '@jest/globals';
import * as vscode from 'vscode';
import { CSharpDevKitExports } from '../../../src/csharpDevKitExports';
import { activateCSharpDevKit } from '../../../src/utils/activateCSharpDevKit';

describe('C# Dev Kit activation', () => {
    test('activates C# Dev Kit once and returns its exports', async () => {
        const exports = {} as CSharpDevKitExports;
        const activation = Promise.resolve(exports);
        let activationCount = 0;
        const extension = {
            activate: async () => {
                activationCount++;
                return activation;
            },
        } as unknown as vscode.Extension<CSharpDevKitExports>;

        const result = activateCSharpDevKit(extension);

        await expect(result).resolves.toBe(exports);
        expect(activationCount).toBe(1);
    });
});
