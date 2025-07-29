/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { CSharpExtensionExports, LimitedExtensionExports } from '../../../src/csharpExtensionExports';

describe(`Untrusted Workspace`, () => {
    test(`Limited activation in untrusted workspace`, async () => {
        // Simulate an untrusted workspace by setting isTrusted to false
        jest.spyOn(vscode.workspace, 'isTrusted', 'get').mockReturnValue(false);

        const extension = vscode.extensions.getExtension<CSharpExtensionExports | LimitedExtensionExports>(
            'ms-dotnettools.csharp'
        );
        if (!extension) {
            throw new Error('Failed to find installation of ms-dotnettools.csharp');
        }

        expect(extension.isActive).toBe(false);
        await extension.activate();

        expect(extension.exports.isLimitedActivation).toBe(true);
    });
});
