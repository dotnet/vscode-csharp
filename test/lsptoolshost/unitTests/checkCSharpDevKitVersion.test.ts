/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { checkCSharpDevKitVersion } from '../../../src/checkCSharpDevKitVersion';
import { CSharpDevKitExports } from '../../../src/csharpDevKitExports';

describe('C# Dev Kit version check', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    test('allows activation when C# Dev Kit is not installed', async () => {
        const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage');

        await checkCSharpDevKitVersion(undefined);

        expect(showErrorMessage).not.toHaveBeenCalled();
    });

    test.each(['11.0.0', '11.0.0-pre.1', '12.0.0'])('allows activation with C# Dev Kit version %s', async (version) => {
        const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage');

        await checkCSharpDevKitVersion(createExtension(version));

        expect(showErrorMessage).not.toHaveBeenCalled();
    });

    test('blocks activation with an older C# Dev Kit version', async () => {
        const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined);

        await expect(checkCSharpDevKitVersion(createExtension('10.9.99'))).rejects.toThrow(
            'This version of the C# extension requires C# Dev Kit version 11 or later. Please install the pre-release version of C# Dev Kit or use the release version of the C# extension.'
        );
        expect(showErrorMessage).toHaveBeenCalledTimes(1);
    });
});

function createExtension(version: string): vscode.Extension<CSharpDevKitExports> {
    return {
        packageJSON: { version },
    } as vscode.Extension<CSharpDevKitExports>;
}
