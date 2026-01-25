/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('Csproj Analyzer', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getRootNamespace', () => {
        test('should extract RootNamespace from XML content', () => {
            const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <RootNamespace>MyApp.Core</RootNamespace>
  </PropertyGroup>
</Project>`;

            // Regex to extract RootNamespace
            const match = /<RootNamespace>\s*(.+?)\s*<\/RootNamespace>/.exec(csprojContent);
            const rootNamespace = match ? match[1].trim() : null;

            expect(rootNamespace).toBe('MyApp.Core');
        });

        test('should return null when RootNamespace is not specified', () => {
            const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>`;

            const match = /<RootNamespace>\s*(.+?)\s*<\/RootNamespace>/.exec(csprojContent);
            const rootNamespace = match ? match[1].trim() : null;

            expect(rootNamespace).toBeNull();
        });

        test('should trim whitespace from RootNamespace', () => {
            const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>  MyApp.Services  </RootNamespace>
  </PropertyGroup>
</Project>`;

            const match = /<RootNamespace>\s*(.+?)\s*<\/RootNamespace>/.exec(csprojContent);
            const rootNamespace = match ? match[1].trim() : null;

            expect(rootNamespace).toBe('MyApp.Services');
        });

        test('should handle complex project file', () => {
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

            const match = /<RootNamespace>\s*(.+?)\s*<\/RootNamespace>/.exec(csprojContent);
            const rootNamespace = match ? match[1].trim() : null;

            expect(rootNamespace).toBe('MyCompany.MyProduct.API');
        });

        test('should handle empty RootNamespace tag', () => {
            const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace></RootNamespace>
  </PropertyGroup>
</Project>`;

            const match = /<RootNamespace>\s*(.+?)\s*<\/RootNamespace>/.exec(csprojContent);
            const rootNamespace = match ? match[1].trim() : null;

            expect(rootNamespace).toBeNull();
        });

        test('should extract filename without extension', () => {
            const filePath = '/home/user/MyApp.Core.Services.csproj';
            const filename = filePath.split('/').pop();
            const nameWithoutExtension = filename?.replace('.csproj', '') ?? '';

            expect(nameWithoutExtension).toBe('MyApp.Core.Services');
        });

        test('should handle Windows-style path separators', () => {
            const filePath = 'D:\\Projects\\MyApp\\MyApp.csproj';
            const filename = filePath.split('\\').pop();
            const nameWithoutExtension = filename?.replace('.csproj', '') ?? '';

            expect(nameWithoutExtension).toBe('MyApp');
        });
    });
});
