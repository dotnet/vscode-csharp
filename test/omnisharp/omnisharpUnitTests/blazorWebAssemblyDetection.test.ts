/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { CreateTmpDir, TmpAsset } from '../../createTmpAsset';
import {
    getBlazorWebAssemblyDebugInfo,
    hasEnableWebAssemblyDebuggingSetting,
    isWebProject,
} from '../../../src/shared/utils';

const webSdkCsproj = `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net11.0</TargetFramework>
  </PropertyGroup>
</Project>`;

const hostedServerCsproj = `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net11.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\\App.Client\\App.Client.csproj" />
    <PackageReference Include="Microsoft.AspNetCore.Components.WebAssembly.Server" Version="11.0.0" />
  </ItemGroup>
</Project>`;

const wasmSdkCsproj = `<Project Sdk="Microsoft.NET.Sdk.BlazorWebAssembly">
  <PropertyGroup>
    <TargetFramework>net11.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Components.WebAssembly" Version="11.0.0" />
  </ItemGroup>
</Project>`;

describe('Blazor WebAssembly detection', () => {
    let tmpDir: TmpAsset;
    let projectPath: string;

    beforeEach(async () => {
        tmpDir = await CreateTmpDir(true);
        projectPath = path.join(tmpDir.name, 'App.csproj');
    });

    afterEach(() => {
        tmpDir.dispose();
    });

    function writeProject(content: string): void {
        fs.writeFileSync(projectPath, content);
    }

    function writeLaunchSettings(content: string): void {
        const propertiesDir = path.join(tmpDir.name, 'Properties');
        fs.mkdirpSync(propertiesDir);
        fs.writeFileSync(path.join(propertiesDir, 'launchSettings.json'), content);
    }

    describe('getBlazorWebAssemblyDebugInfo', () => {
        test('classifies a standalone Blazor WebAssembly SDK project as standalone', () => {
            writeProject(wasmSdkCsproj);
            const [webProject, webAssemblyProject] = isWebProject(projectPath);

            const info = getBlazorWebAssemblyDebugInfo(projectPath, /*isExe*/ true, webProject, webAssemblyProject);

            expect(info.isBlazorWebAssemblyStandalone).toBe(true);
            expect(info.isBlazorWebAssemblyHosted).toBe(false);
        });

        test('classifies a Web SDK host referencing WebAssembly.Server as hosted', () => {
            writeProject(hostedServerCsproj);
            const [webProject, webAssemblyProject] = isWebProject(projectPath);

            const info = getBlazorWebAssemblyDebugInfo(projectPath, /*isExe*/ true, webProject, webAssemblyProject);

            expect(info.isBlazorWebAssemblyHosted).toBe(true);
            expect(info.isBlazorWebAssemblyStandalone).toBe(false);
        });

        test('does not classify a plain Web SDK project as Blazor WebAssembly', () => {
            writeProject(webSdkCsproj);
            const [webProject, webAssemblyProject] = isWebProject(projectPath);

            const info = getBlazorWebAssemblyDebugInfo(projectPath, /*isExe*/ true, webProject, webAssemblyProject);

            expect(info.isBlazorWebAssemblyHosted).toBe(false);
            expect(info.isBlazorWebAssemblyStandalone).toBe(false);
        });

        test('does not classify a non-executable Web SDK host as hosted', () => {
            writeProject(hostedServerCsproj);
            const [webProject, webAssemblyProject] = isWebProject(projectPath);

            const info = getBlazorWebAssemblyDebugInfo(projectPath, /*isExe*/ false, webProject, webAssemblyProject);

            expect(info.isBlazorWebAssemblyHosted).toBe(false);
        });

        test('escape hatch forces a Web SDK host to be treated as hosted', () => {
            writeProject(webSdkCsproj);
            writeLaunchSettings(
                JSON.stringify({ profiles: { https: { commandName: 'Project', enableWebAssemblyDebugging: true } } })
            );
            const [webProject, webAssemblyProject] = isWebProject(projectPath);

            const info = getBlazorWebAssemblyDebugInfo(projectPath, /*isExe*/ true, webProject, webAssemblyProject);

            expect(info.isBlazorWebAssemblyHosted).toBe(true);
            expect(info.isBlazorWebAssemblyStandalone).toBe(false);
        });

        test('escape hatch forces a non-web project to be treated as standalone', () => {
            writeProject(webSdkCsproj.replace('Microsoft.NET.Sdk.Web', 'Microsoft.NET.Sdk'));
            writeLaunchSettings(
                JSON.stringify({ profiles: { https: { commandName: 'Project', enableWebAssemblyDebugging: true } } })
            );
            const [webProject, webAssemblyProject] = isWebProject(projectPath);

            const info = getBlazorWebAssemblyDebugInfo(projectPath, /*isExe*/ true, webProject, webAssemblyProject);

            expect(info.isBlazorWebAssemblyStandalone).toBe(true);
            expect(info.isBlazorWebAssemblyHosted).toBe(false);
        });
    });

    describe('hasEnableWebAssemblyDebuggingSetting', () => {
        test('returns false when launchSettings.json is missing', () => {
            writeProject(webSdkCsproj);
            expect(hasEnableWebAssemblyDebuggingSetting(projectPath)).toBe(false);
        });

        test('returns false when no profile enables WebAssembly debugging', () => {
            writeProject(webSdkCsproj);
            writeLaunchSettings(JSON.stringify({ profiles: { https: { commandName: 'Project' } } }));
            expect(hasEnableWebAssemblyDebuggingSetting(projectPath)).toBe(false);
        });

        test('returns true when a profile enables WebAssembly debugging', () => {
            writeProject(webSdkCsproj);
            writeLaunchSettings(
                JSON.stringify({
                    profiles: { http: {}, https: { enableWebAssemblyDebugging: true } },
                })
            );
            expect(hasEnableWebAssemblyDebuggingSetting(projectPath)).toBe(true);
        });

        test('falls back to lenient matching when launchSettings.json has comments', () => {
            writeProject(webSdkCsproj);
            writeLaunchSettings(`{
                // launch profiles
                "profiles": {
                    "https": {
                        "enableWebAssemblyDebugging": true
                    }
                }
            }`);
            expect(hasEnableWebAssemblyDebuggingSetting(projectPath)).toBe(true);
        });
    });
});
