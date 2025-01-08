/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    dotnetAcquisitionExtensionOption,
    dotnetPathOption,
    IDotnetAcquisitionExistingPaths,
    MigrateOptions,
    migrateOptions,
} from '../../../src/shared/migrateOptions';
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { getVSCodeWithConfig } from '../../fakes';
import { CSharpExtensionId } from '../../../src/constants/csharpExtensionId';
import { ConfigurationTarget } from '../../../src/vscodeAdapter';

// Necessary when spying on module members.
jest.mock('fs', () => ({ __esModule: true, ...(<any>jest.requireActual('fs')) }));

describe('Migrate configurations', () => {
    const packageJson = JSON.parse(fs.readFileSync('package.json').toString());
    const configuration = packageJson.contributes.configuration;
    // Read the "Project", "Text Editor", "Debugger", "LSP Server" sections of the package.json
    const configurations = [
        ...Object.keys(configuration[0].properties),
        ...Object.keys(configuration[1].properties),
        ...Object.keys(configuration[2].properties),
        ...Object.keys(configuration[3].properties),
    ];

    const validDotnetFolder = path.join('csharp', 'dotnet');
    const validDotnetPath = path.join(validDotnetFolder, `dotnet${process.platform === 'win32' ? '.exe' : ''}`);

    beforeEach(() => {
        jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
            if (path.toString().endsWith(validDotnetPath)) {
                return true;
            }

            return false;
        });
    });

    migrateOptions.forEach((data) => {
        test(`Should have ${data.newName} in package.json`, () => {
            expect(configurations).toContain(data.newName);
        });
    });

    test(`dotnet.dotnetPath should create new dotnetAcquisitionExtension.existingDotnetPath value`, async () => {
        getVSCodeWithConfig(vscode);

        vscode.workspace.getConfiguration().update(dotnetPathOption, validDotnetFolder);

        await MigrateOptions(vscode);

        const updatedConfigurations = vscode.workspace.getConfiguration();
        const acquisitionPath = updatedConfigurations.get<IDotnetAcquisitionExistingPaths[] | undefined>(
            dotnetAcquisitionExtensionOption
        );
        expect(acquisitionPath).toBeDefined();
        expect(acquisitionPath!.length).toEqual(1);
        expect(acquisitionPath![0].path).toEqual(validDotnetPath);
        expect(acquisitionPath![0].extensionId).toEqual(CSharpExtensionId);
        expect(updatedConfigurations.get(dotnetPathOption)).toBeUndefined();
    });

    test(`dotnet.dotnetPath should not overwrite existing dotnetAcquisitionExtension.existingDotnetPath value`, async () => {
        getVSCodeWithConfig(vscode);

        // Set both dotnet.dotnetPath and dotnetAcquisitionExtension.existingDotnetPath for the C# extension
        vscode.workspace.getConfiguration().update(dotnetPathOption, validDotnetFolder);
        vscode.workspace.getConfiguration().update(dotnetAcquisitionExtensionOption, [
            {
                path: 'differentCSharp\\dotnet.exe',
                extensionId: CSharpExtensionId,
            },
        ]);

        await MigrateOptions(vscode);

        // Only dotnet.dotnetPath should be deleted, dotnetAcquisitionExtension.existingDotnetPath should be unchanged.
        const updatedConfigurations = vscode.workspace.getConfiguration();
        const acquisitionPath = updatedConfigurations.get<IDotnetAcquisitionExistingPaths[] | undefined>(
            dotnetAcquisitionExtensionOption
        );
        expect(acquisitionPath).toBeDefined();
        expect(acquisitionPath!.length).toEqual(1);
        expect(acquisitionPath![0].path).toEqual('differentCSharp\\dotnet.exe');
        expect(acquisitionPath![0].extensionId).toEqual(CSharpExtensionId);
        expect(updatedConfigurations.get(dotnetPathOption)).toBeUndefined();
    });

    test(`dotnet.dotnetPath should not update dotnetAcquisitionExtension.existingDotnetPath if invalid`, async () => {
        getVSCodeWithConfig(vscode);

        vscode.workspace.getConfiguration().update(dotnetPathOption, 'invalid\\dotnet');

        await MigrateOptions(vscode);

        const updatedConfigurations = vscode.workspace.getConfiguration();
        const acquisitionPath = updatedConfigurations.get<IDotnetAcquisitionExistingPaths[] | undefined>(
            dotnetAcquisitionExtensionOption
        );
        expect(acquisitionPath).toBeUndefined();
        expect(updatedConfigurations.get(dotnetPathOption)).toBeUndefined();
    });

    test(`dotnet.dotnetPath should append to existing dotnetAcquisitionExtension.existingDotnetPath values`, async () => {
        getVSCodeWithConfig(vscode);

        // Set dotnet.dotnetPath and dotnetAcquisitionExtension.existingDotnetPath for a different extension
        vscode.workspace.getConfiguration().update(dotnetPathOption, validDotnetFolder);
        vscode.workspace.getConfiguration().update(dotnetAcquisitionExtensionOption, [
            {
                path: 'otherExtension\\dotnet.exe',
                extensionId: 'some.other.extension',
            },
        ]);

        await MigrateOptions(vscode);

        // dotnet.dotnetPath should be removed and the value appended to dotnetAcquisitionExtension.existingDotnetPath.
        const updatedConfigurations = vscode.workspace.getConfiguration();
        const acquisitionPath = updatedConfigurations
            .get<IDotnetAcquisitionExistingPaths[] | undefined>(dotnetAcquisitionExtensionOption)
            ?.sort((a, b) => a.extensionId.localeCompare(b.extensionId));
        expect(acquisitionPath).toBeDefined();
        expect(acquisitionPath!.length).toEqual(2);
        expect(acquisitionPath![0].path).toEqual(validDotnetPath);
        expect(acquisitionPath![0].extensionId).toEqual(CSharpExtensionId);
        expect(updatedConfigurations.get(dotnetPathOption)).toBeUndefined();
    });

    test(`dotnet.dotnetPath is migrated for all configuration targets`, async () => {
        getVSCodeWithConfig(vscode);

        // Set dotnet.dotnetPath for all configuration targets
        vscode.workspace
            .getConfiguration()
            .update(dotnetPathOption, 'global' + validDotnetFolder, ConfigurationTarget.Global);
        vscode.workspace
            .getConfiguration()
            .update(dotnetPathOption, 'workspace' + validDotnetFolder, ConfigurationTarget.Workspace);
        vscode.workspace
            .getConfiguration()
            .update(dotnetPathOption, 'workspaceFolder' + validDotnetFolder, ConfigurationTarget.WorkspaceFolder);

        await MigrateOptions(vscode);

        // dotnet.dotnetPath should be removed and the value appended to dotnetAcquisitionExtension.existingDotnetPath for all configuration targets.

        const inspectDotnetPath = vscode.workspace.getConfiguration().inspect(dotnetPathOption);
        expect(inspectDotnetPath?.globalValue).toBeUndefined();
        expect(inspectDotnetPath?.workspaceValue).toBeUndefined();
        expect(inspectDotnetPath?.workspaceFolderValue).toBeUndefined();

        const inspectAcquisitionPath = vscode.workspace
            .getConfiguration()
            .inspect<IDotnetAcquisitionExistingPaths[]>(dotnetAcquisitionExtensionOption);
        expect(inspectAcquisitionPath?.globalValue).toBeDefined();
        expect(inspectAcquisitionPath!.globalValue![0].path).toEqual('global' + validDotnetPath);

        expect(inspectAcquisitionPath?.workspaceValue).toBeDefined();
        expect(inspectAcquisitionPath!.workspaceValue![0].path).toEqual('workspace' + validDotnetPath);

        expect(inspectAcquisitionPath?.workspaceFolderValue).toBeDefined();
        expect(inspectAcquisitionPath!.workspaceFolderValue![0].path).toEqual('workspaceFolder' + validDotnetPath);
    });

    test(`dotnet.dotnetPath should migrate to omnisharp.dotnetPath when using O#`, async () => {
        getVSCodeWithConfig(vscode);

        vscode.workspace.getConfiguration().update(dotnetPathOption, validDotnetFolder);
        vscode.workspace.getConfiguration().update('dotnet.server.useOmnisharp', true);

        await MigrateOptions(vscode);

        const updatedConfigurations = vscode.workspace.getConfiguration();
        const acquisitionPath = updatedConfigurations.get<IDotnetAcquisitionExistingPaths[] | undefined>(
            dotnetAcquisitionExtensionOption
        );
        expect(acquisitionPath).toBeUndefined();
        expect(updatedConfigurations.get('omnisharp.dotnetPath')).toEqual(validDotnetFolder);
        expect(updatedConfigurations.get(dotnetPathOption)).toBeUndefined();
    });
});
