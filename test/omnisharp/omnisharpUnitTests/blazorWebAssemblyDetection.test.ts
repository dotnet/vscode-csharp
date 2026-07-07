/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { CreateTmpDir, TmpAsset } from '../../createTmpAsset';
import { isBlazorWebAssemblyHostedServer, isBlazorWebAssemblyProject, isWebProject } from '../../../src/shared/utils';

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

    describe('isBlazorWebAssemblyProject (launchSettings-based, additive escape hatch)', () => {
        test('returns false when launchSettings.json is missing', async () => {
            writeProject(webSdkCsproj);
            expect(await isBlazorWebAssemblyProject(projectPath)).toBe(false);
        });

        test('returns true when a profile contains inspectUri (original behavior)', async () => {
            writeProject(webSdkCsproj);
            writeLaunchSettings(
                JSON.stringify({
                    profiles: {
                        https: {
                            inspectUri:
                                '{wsProtocol}://{url.hostname}:{url.port}/_framework/debug/ws-proxy?browser={browserInspectUri}',
                        },
                    },
                })
            );
            expect(await isBlazorWebAssemblyProject(projectPath)).toBe(true);
        });

        test('returns true when a profile enables WebAssembly debugging (escape hatch)', async () => {
            writeProject(webSdkCsproj);
            writeLaunchSettings(JSON.stringify({ profiles: { https: { enableWebAssemblyDebugging: true } } }));
            expect(await isBlazorWebAssemblyProject(projectPath)).toBe(true);
        });

        test('honors the escape hatch even when launchSettings.json contains comments', async () => {
            writeProject(webSdkCsproj);
            writeLaunchSettings(`{
                // launch profiles
                "profiles": {
                    "https": {
                        "enableWebAssemblyDebugging": true
                    }
                }
            }`);
            expect(await isBlazorWebAssemblyProject(projectPath)).toBe(true);
        });

        test('returns false when neither signal is present', async () => {
            writeProject(webSdkCsproj);
            writeLaunchSettings(JSON.stringify({ profiles: { https: { commandName: 'Project' } } }));
            expect(await isBlazorWebAssemblyProject(projectPath)).toBe(false);
        });
    });

    describe('isBlazorWebAssemblyHostedServer (project-based, additive)', () => {
        test('detects a Web SDK host referencing WebAssembly.Server', () => {
            writeProject(hostedServerCsproj);
            const [webProject] = isWebProject(projectPath);
            expect(isBlazorWebAssemblyHostedServer(projectPath, /*isExe*/ true, webProject)).toBe(true);
        });

        test('does not detect a plain Web SDK project', () => {
            writeProject(webSdkCsproj);
            const [webProject] = isWebProject(projectPath);
            expect(isBlazorWebAssemblyHostedServer(projectPath, /*isExe*/ true, webProject)).toBe(false);
        });

        test('does not detect a non-executable host', () => {
            writeProject(hostedServerCsproj);
            const [webProject] = isWebProject(projectPath);
            expect(isBlazorWebAssemblyHostedServer(projectPath, /*isExe*/ false, webProject)).toBe(false);
        });

        test('does not detect a non-web project', () => {
            writeProject(wasmSdkCsproj);
            const [webProject] = isWebProject(projectPath);
            expect(isBlazorWebAssemblyHostedServer(projectPath, /*isExe*/ true, webProject)).toBe(false);
        });
    });

    describe('isWebProject WebAssembly SDK signal (used additively for standalone)', () => {
        test('recognizes a Blazor WebAssembly SDK project', () => {
            writeProject(wasmSdkCsproj);
            const [webProject, webAssemblyProject] = isWebProject(projectPath);
            expect(webProject).toBe(false);
            expect(webAssemblyProject).toBe(true);
        });
    });
});
