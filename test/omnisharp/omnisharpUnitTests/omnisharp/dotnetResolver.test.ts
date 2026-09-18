/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { DotnetResolver } from '../../../../src/omnisharp/dotnetResolver';
import { PlatformInformation } from '../../../../src/shared/platform';
import { CreateTmpDir, TmpAsset } from '../../../createTmpAsset';
import { getWorkspaceConfiguration } from '../../../fakes';

describe(DotnetResolver.name, () => {
    let configuration: vscode.WorkspaceConfiguration;
    let temporaryDirectory: TmpAsset | undefined;

    beforeEach(() => {
        configuration = getWorkspaceConfiguration();
        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(configuration);
    });

    afterEach(() => {
        temporaryDirectory?.dispose();
        temporaryDirectory = undefined;
    });

    test('uses the configured executable as the OmniSharp host', async () => {
        temporaryDirectory = await CreateTmpDir(true);
        const dotnetExecutable = path.join(temporaryDirectory.name, 'dotnet');
        fs.writeFileSync(dotnetExecutable, '');
        await configuration.update('omnisharp.dotnetPath', temporaryDirectory.name);
        const executeVersion = jest.fn(async () => '10.0.100\n');
        const resolver = new DotnetResolver(new PlatformInformation('linux', 'x86_64'), executeVersion);

        const result = await resolver.getHostExecutableInfo();

        expect(executeVersion).toHaveBeenCalledWith(dotnetExecutable, expect.any(Object));
        expect(result.path).toEqual(dotnetExecutable);
        expect(result.version).toEqual('10.0.100');
        expect(result.env.PATH?.startsWith(`${temporaryDirectory.name}${path.delimiter}`)).toBe(true);
    });

    test('uses the system executable when no host path is configured', async () => {
        const executeVersion = jest.fn(async () => '10.0.100');
        const resolver = new DotnetResolver(new PlatformInformation('linux', 'x86_64'), executeVersion);

        const result = await resolver.getHostExecutableInfo();

        expect(executeVersion).toHaveBeenCalledWith('dotnet', expect.any(Object));
        expect(result.path).toEqual('dotnet');
    });

    test('rejects a configured directory without a dotnet executable', async () => {
        temporaryDirectory = await CreateTmpDir(true);
        await configuration.update('omnisharp.dotnetPath', temporaryDirectory.name);
        const executeVersion = jest.fn(async () => '10.0.100');
        const resolver = new DotnetResolver(new PlatformInformation('linux', 'x86_64'), executeVersion);

        await expect(resolver.getHostExecutableInfo()).rejects.toThrow(
            `The configured OmniSharp .NET host does not exist: ${path.join(temporaryDirectory.name, 'dotnet')}`
        );
        expect(executeVersion).not.toHaveBeenCalled();
    });

    test('rejects a host older than .NET 10', async () => {
        const resolver = new DotnetResolver(new PlatformInformation('linux', 'x86_64'), async () => '6.0.428');

        await expect(resolver.getHostExecutableInfo()).rejects.toThrow(
            'Found dotnet version 6.0.428. Minimum required version is 10.0.0.'
        );
    });

    test('caches the host used for validation and launch', async () => {
        const executeVersion = jest.fn(async () => '10.0.100');
        const resolver = new DotnetResolver(new PlatformInformation('linux', 'x86_64'), executeVersion);

        const validationResult = await resolver.getHostExecutableInfo();
        const launchResult = await resolver.getHostExecutableInfo();

        expect(launchResult).toBe(validationResult);
        expect(executeVersion).toHaveBeenCalledTimes(1);
    });
});
