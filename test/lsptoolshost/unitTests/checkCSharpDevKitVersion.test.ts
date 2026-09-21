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
            'C# Dev Kit version 11 or later is required. Please switch to the pre-release version of the C# Dev Kit.'
        );
        expect(showErrorMessage).toHaveBeenCalledTimes(1);
        expect(showErrorMessage).toHaveBeenCalledWith(expect.any(String), { modal: true }, 'Open C# Dev Kit');
    });

    test('opens C# Dev Kit when requested', async () => {
        jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue('Open C# Dev Kit' as never);
        const executeCommand = jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

        await expect(checkCSharpDevKitVersion(createExtension('10.9.99'))).rejects.toThrow();

        expect(executeCommand).toHaveBeenCalledWith('extension.open', 'ms-dotnettools.csdevkit');
    });
});

function createExtension(version: string): vscode.Extension<CSharpDevKitExports> {
    return {
        packageJSON: { version },
    } as vscode.Extension<CSharpDevKitExports>;
}
