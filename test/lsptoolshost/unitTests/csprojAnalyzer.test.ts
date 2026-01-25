/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import * as vscode from 'vscode';
import { getRootNamespace } from '../../../src/lsptoolshost/refactoring/csprojAnalyzer';

// Mock vscode.workspace.fs
jest.mock('vscode', () => ({
    Uri: {
        file: (p: string) => ({ fsPath: p, path: p }),
    },
    workspace: {
        fs: {
            readFile: jest.fn(),
        },
    },
}));

// Get reference to the mocked readFile
const mockReadFile = vscode.workspace.fs.readFile as jest.MockedFunction<(uri: vscode.Uri) => Promise<Uint8Array>>;

describe('Csproj Analyzer', () => {
    beforeEach(() => {
        mockReadFile.mockClear();
    });

    describe('getRootNamespace', () => {
        test('should extract RootNamespace from XML content', async () => {
            const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <RootNamespace>MyApp.Core</RootNamespace>
  </PropertyGroup>
</Project>`;

            const mockUri = vscode.Uri.file('C:/Projects/MyApp/MyApp.csproj');
            mockReadFile.mockResolvedValue(Buffer.from(csprojContent));

            const rootNamespace = await getRootNamespace(mockUri);

            expect(rootNamespace).toBe('MyApp.Core');
        });

        test('should fallback to filename when RootNamespace is not specified', async () => {
            const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>`;

            const mockUri = vscode.Uri.file('C:/Projects/MyApp/MyApp.csproj');
            mockReadFile.mockResolvedValue(Buffer.from(csprojContent));

            const rootNamespace = await getRootNamespace(mockUri);

            expect(rootNamespace).toBe('MyApp');
        });

        test('should trim whitespace from RootNamespace', async () => {
            const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>  MyApp.Services  </RootNamespace>
  </PropertyGroup>
</Project>`;

            const mockUri = vscode.Uri.file('C:/Projects/MyApp/MyApp.csproj');
            mockReadFile.mockResolvedValue(Buffer.from(csprojContent));

            const rootNamespace = await getRootNamespace(mockUri);

            expect(rootNamespace).toBe('MyApp.Services');
        });

        test('should handle complex project file', async () => {
            const csprojContent = `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>MyCompany.MyProduct.API</RootNamespace>
    <AssemblyName>MyProduct.API</AssemblyName>
  </PropertyGroup>
  
  <ItemGroup>
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
  </ItemGroup>
</Project>`;

            const mockUri = vscode.Uri.file('C:/Projects/MyApp/MyProduct.API.csproj');
            mockReadFile.mockResolvedValue(Buffer.from(csprojContent));

            const rootNamespace = await getRootNamespace(mockUri);

            expect(rootNamespace).toBe('MyCompany.MyProduct.API');
        });

        test('should fallback to filename when RootNamespace tag is empty', async () => {
            const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace></RootNamespace>
  </PropertyGroup>
</Project>`;

            const mockUri = vscode.Uri.file('C:/Projects/MyApp/MyApp.csproj');
            mockReadFile.mockResolvedValue(Buffer.from(csprojContent));

            const rootNamespace = await getRootNamespace(mockUri);

            expect(rootNamespace).toBe('MyApp');
        });
    });
});
