/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Contains APIs defined by the vscode-dotnet-runtime extension

export interface IDotnetAcquireResult {
    dotnetPath: string;
}

export interface IDotnetFindPathContext {
    acquireContext: IDotnetAcquireContext;
    versionSpecRequirement: DotnetVersionSpecRequirement;
}

/**
 * https://github.com/dotnet/vscode-dotnet-runtime/blob/main/vscode-dotnet-runtime-library/src/IDotnetAcquireContext.ts
 */
interface IDotnetAcquireContext {
    version: string;
    requestingExtensionId?: string;
    errorConfiguration?: AcquireErrorConfiguration;
    installType?: DotnetInstallType;
    architecture?: string | null | undefined;
    mode?: DotnetInstallMode;
}

/**
 * https://github.com/dotnet/vscode-dotnet-runtime/blob/main/vscode-dotnet-runtime-library/src/IDotnetAcquireContext.ts#L53C8-L53C52
 */
type DotnetInstallType = 'local' | 'global';

/**
 * https://github.com/dotnet/vscode-dotnet-runtime/blob/main/vscode-dotnet-runtime-library/src/Utils/ErrorHandler.ts#L22
 */
enum AcquireErrorConfiguration {
    DisplayAllErrorPopups = 0,
    DisableErrorPopups = 1,
}

/**
 * https://github.com/dotnet/vscode-dotnet-runtime/blob/main/vscode-dotnet-runtime-library/src/Acquisition/DotnetInstallMode.ts
 */
type DotnetInstallMode = 'sdk' | 'runtime' | 'aspnetcore';

/**
 * https://github.com/dotnet/vscode-dotnet-runtime/blob/main/vscode-dotnet-runtime-library/src/DotnetVersionSpecRequirement.ts
 */
type DotnetVersionSpecRequirement = 'equal' | 'greater_than_or_equal' | 'less_than_or_equal';
