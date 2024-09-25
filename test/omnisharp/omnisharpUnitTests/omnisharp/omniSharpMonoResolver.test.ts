/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { OmniSharpMonoResolver } from '../../../../src/omnisharp/omniSharpMonoResolver';

import { join } from 'path';
import { getWorkspaceConfiguration } from '../../../fakes';

describe(`${OmniSharpMonoResolver.name}`, () => {
    let getMonoCalled: boolean;

    const monoPath = 'monoPath';

    const lowerMonoVersion = '6.2.0';
    const requiredMonoVersion = '6.4.0';
    const higherMonoVersion = '6.6.0';

    const getMono = (version: string) => async (_: NodeJS.ProcessEnv) => {
        getMonoCalled = true;
        return Promise.resolve(version);
    };

    beforeEach(async () => {
        getMonoCalled = false;
        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(getWorkspaceConfiguration());
        await vscode.workspace.getConfiguration().update('omnisharp.monoPath', monoPath);
    });

    test(`it returns the path and version if the version is greater than or equal to ${requiredMonoVersion}`, async () => {
        const monoResolver = new OmniSharpMonoResolver(getMono(higherMonoVersion));
        const monoInfo = await monoResolver.getHostExecutableInfo();

        expect(monoInfo.version).toEqual(higherMonoVersion);
        expect(monoInfo.path).toEqual(monoPath);
    });

    test(`it throws exception if version is less than ${requiredMonoVersion}`, async () => {
        const monoResolver = new OmniSharpMonoResolver(getMono(lowerMonoVersion));

        await expect(monoResolver.getHostExecutableInfo()).rejects.toThrow();
    });

    test('sets the environment with the monoPath', async () => {
        const monoResolver = new OmniSharpMonoResolver(getMono(requiredMonoVersion));
        const monoInfo = await monoResolver.getHostExecutableInfo();

        expect(getMonoCalled).toEqual(true);
        expect(monoInfo.env['PATH']).toContain(join(monoPath, 'bin'));
        expect(monoInfo.env['MONO_GAC_PREFIX']).toEqual(monoPath);
    });
});
