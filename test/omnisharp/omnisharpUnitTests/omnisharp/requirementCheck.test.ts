/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { validateRequirements } from '../../../../src/omnisharp/requirementCheck';
import { IHostExecutableResolver } from '../../../../src/shared/constants/IHostExecutableResolver';

describe(validateRequirements.name, () => {
    beforeEach(() => {
        jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined);
    });

    test('accepts the host selected by the resolver', async () => {
        const resolver: IHostExecutableResolver = {
            getHostExecutableInfo: jest.fn(async () => ({
                version: '10.0.100',
                path: '/host/dotnet',
                env: {},
            })),
        };

        expect(await validateRequirements(resolver)).toBe(true);
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    test('rejects the host selected by the resolver regardless of project CLI paths', async () => {
        const resolver: IHostExecutableResolver = {
            getHostExecutableInfo: jest.fn(async () => {
                throw new Error('Found dotnet version 6.0.428. Minimum required version is 10.0.0.');
            }),
        };

        expect(await validateRequirements(resolver)).toBe(false);
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('OmniSharp requires the .NET 10 SDK'),
            { modal: true },
            expect.objectContaining({ title: 'Get the SDK' })
        );
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Found dotnet version 6.0.428'),
            { modal: true },
            expect.objectContaining({ title: 'Get the SDK' })
        );
    });
});
