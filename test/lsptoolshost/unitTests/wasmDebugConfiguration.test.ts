/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    IWorkspaceDebugInformationProvider,
    ProjectDebugInformation,
} from '../../../src/shared/IWorkspaceDebugInformationProvider';
import { DotnetWorkspaceConfigurationProvider } from '../../../src/shared/workspaceConfigurationProvider';
import { PlatformInformation } from '../../../src/shared/platform';
import { BlazorDebugConfigurationProvider } from '../../../src/razor/src/blazorDebug/blazorDebugConfigurationProvider';
import { getCSharpDevKit } from '../../../src/utils/getCSharpDevKit';

jest.mock('vscode', () => {
    const mock = jest.requireActual<typeof import('vscode')>('../../../__mocks__/vscode');
    return {
        ...mock,
        window: {
            ...mock.window,
            createOutputChannel: jest.fn(() => ({
                name: 'Test',
                appendLine: jest.fn(),
                trace: jest.fn(),
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            })),
        },
    };
});
jest.mock('../../../src/utils/getCSharpDevKit', () => ({
    getCSharpDevKit: jest.fn(() => ({})),
}));

const devKit = getCSharpDevKit();

describe('WebAssembly debug configuration resolution', () => {
    let folder: vscode.WorkspaceFolder;
    let client: ProjectDebugInformation;
    let otherClient: ProjectDebugInformation;
    let unrelated: ProjectDebugInformation;
    let resolver: DotnetWorkspaceConfigurationProvider;
    let workspaceDebugInfoProvider: jest.Mocked<IWorkspaceDebugInformationProvider>;

    beforeEach(() => {
        folder = { uri: vscode.Uri.file(path.resolve('testRoot')), name: 'workspace', index: 0 };
        unrelated = createProject('Unrelated', false);
        unrelated.projectPath = path.join(folder.uri.fsPath, 'Migration.cs');
        unrelated.outputPath = path.join(folder.uri.fsPath, 'runfile', 'Migration.dll');
        otherClient = createProject('Other.Client', true, 'net8.0');
        client = createProject('Web.Client', true);
        const readFileSync = fs.readFileSync;
        jest.spyOn(fs, 'readFileSync').mockImplementation((file, options) => {
            if (file === client.projectPath || file === otherClient.projectPath) {
                const framework = file === otherClient.projectPath ? 'net8.0' : 'net11.0';
                return `<Project><PropertyGroup><TargetFramework>${framework}</TargetFramework></PropertyGroup></Project>`;
            }
            return readFileSync(file, options);
        });
        workspaceDebugInfoProvider = {
            getWorkspaceDebugInformation: jest
                .fn<IWorkspaceDebugInformationProvider['getWorkspaceDebugInformation']>()
                .mockResolvedValue([unrelated, otherClient, client]),
        };
        resolver = new DotnetWorkspaceConfigurationProvider(
            workspaceDebugInfoProvider,
            new PlatformInformation('linux', 'x86_64'),
            vscode.window.createOutputChannel('Test')
        );
        jest.mocked(getCSharpDevKit).mockReturnValue(devKit);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function createProject(
        name: string,
        isWebAssemblyProject: boolean,
        targetFramework = 'net11.0'
    ): ProjectDebugInformation {
        const projectDirectory = path.join(folder.uri.fsPath, name);
        const projectPath = path.join(projectDirectory, `${name}.csproj`);
        return {
            projectPath,
            outputPath: path.join(projectDirectory, 'bin', 'Debug', targetFramework, `${name}.dll`),
            projectName: name,
            solutionPath: null,
            targetsDotnetCore: true,
            isExe: true,
            isWebProject: false,
            isWebAssemblyProject,
            isBlazorWebAssemblyHosted: false,
            isBlazorWebAssemblyStandalone: isWebAssemblyProject,
        };
    }

    function managedConfiguration(): vscode.DebugConfiguration {
        return {
            name: 'Wasm Managed Debugger',
            type: 'monovsdbg_wasm',
            request: 'launch',
            projectPath: client.projectPath,
            monoDebuggerOptions: { platform: 'browser' },
        };
    }

    function expectedAssets(project: ProjectDebugInformation): string {
        return path.join(path.dirname(project.outputPath), path.sep);
    }

    test('does not fall back to a different project when the requested project is missing', async () => {
        await expect(
            resolver.getAssetsPathAndProgram(folder, path.join(folder.uri.fsPath, 'Missing.csproj'))
        ).rejects.toThrow('Unable to determine WebAssembly debug settings for project');
    });

    test('legacy configurations without a project path select a WASM program, not another executable', async () => {
        expect(await resolver.getAssetsPathAndProgram(folder)).toEqual([
            [expectedAssets(otherClient), expectedAssets(client)].join(';'),
            otherClient.outputPath,
        ]);
    });

    test('does not return a non-WASM program when no WASM projects exist', async () => {
        workspaceDebugInfoProvider.getWorkspaceDebugInformation.mockResolvedValue([unrelated]);
        expect(await resolver.getAssetsPathAndProgram(folder)).toEqual(['', '']);
    });

    test('rejects the requested pre-.NET 9 project without Dev Kit despite another supported project', async () => {
        jest.mocked(getCSharpDevKit).mockReturnValue(undefined);
        workspaceDebugInfoProvider.getWorkspaceDebugInformation.mockResolvedValue([unrelated, client, otherClient]);
        const configuration = managedConfiguration();
        configuration.projectPath = otherClient.projectPath;

        await expect(
            resolver.resolveDebugConfigurationWithSubstitutedVariables(folder, configuration)
        ).resolves.toBeUndefined();
    });

    test.each([true, false])(
        'resolves the requested workspace-relative browser project with Dev Kit installed: %s',
        async (installed) => {
            jest.mocked(getCSharpDevKit).mockReturnValue(installed ? devKit : undefined);
            const configuration = managedConfiguration();
            const relativePath = path.relative(folder.uri.fsPath, client.projectPath).replaceAll(path.sep, '/');
            configuration.projectPath = process.platform === 'win32' ? relativePath.toUpperCase() : relativePath;

            expect(await resolver.resolveDebugConfigurationWithSubstitutedVariables(folder, configuration)).toBe(
                configuration
            );
            expect(configuration.program).toBe(client.outputPath);
            expect(configuration.monoDebuggerOptions.assetsPath).toBe(expectedAssets(client));
        }
    );

    test('preserves an explicit program while resolving assets', async () => {
        const configuration = managedConfiguration();
        configuration.program = path.join(folder.uri.fsPath, 'custom', 'Web.Client.dll');

        await resolver.resolveDebugConfigurationWithSubstitutedVariables(folder, configuration);

        expect(configuration.program).toBe(path.join(folder.uri.fsPath, 'custom', 'Web.Client.dll'));
        expect(configuration.monoDebuggerOptions.assetsPath).toBe(expectedAssets(client));
    });

    test('preserves the requested project in the managed browser configuration', async () => {
        const launchBridge = BlazorDebugConfigurationProvider['launchVsWebAssemblyBridge'];
        BlazorDebugConfigurationProvider['launchVsWebAssemblyBridge'] = async () => ['ws://localhost', 1234, 5678];
        try {
            const provider = new BlazorDebugConfigurationProvider(
                vscode.window.createOutputChannel('Test', { log: true }),
                vscode
            );
            const { app } = await provider['createManagedDebugConfigurationOnBrowser'](
                {
                    name: 'Debug Browser',
                    type: 'blazorwasm',
                    request: 'attach',
                    projectPath: client.projectPath,
                    url: 'https://localhost:5001',
                },
                'https://localhost:5001'
            );

            expect(app.projectPath).toBe(client.projectPath);
        } finally {
            BlazorDebugConfigurationProvider['launchVsWebAssemblyBridge'] = launchBridge;
        }
    });
});
