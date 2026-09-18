/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { configure } from '../../../../src/omnisharp/launcher';
import { IHostExecutableResolver } from '../../../../src/shared/constants/IHostExecutableResolver';
import { getWorkspaceConfiguration } from '../../../fakes';

describe(configure.name, () => {
    const resolver: IHostExecutableResolver = {
        getHostExecutableInfo: async () => ({
            version: '10.0.100',
            path: '/custom/dotnet',
            env: { TEST_ENV: 'true' },
        }),
    };

    beforeEach(() => {
        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(getWorkspaceConfiguration());
    });

    test('launches OmniSharp.dll with the host validated by the resolver', async () => {
        const configuration = await configure('/workspace', [], '/server/OmniSharp.dll', resolver);

        expect(configuration.path).toEqual('/custom/dotnet');
        expect(configuration.args[0]).toEqual('/server/OmniSharp.dll');
        expect(configuration.hostPath).toEqual('/custom/dotnet');
        expect(configuration.hostVersion).toEqual('10.0.100');
        expect(configuration.env.TEST_ENV).toEqual('true');
    });

    test('preserves an explicit executable launch path', async () => {
        const configuration = await configure('/workspace', [], '/server/OmniSharp', resolver);

        expect(configuration.path).toEqual('/server/OmniSharp');
        expect(configuration.args).not.toContain('/server/OmniSharp');
        expect(configuration.hostPath).toEqual('/custom/dotnet');
    });
});
