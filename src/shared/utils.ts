/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as path from 'path';

export function findNetFrameworkTargetFramework(tfmShortNames: string[]): string | undefined {
    const regexp = new RegExp('^net[1-4]');
    return tfmShortNames.find((tf) => regexp.test(tf));
}

export function findNetCoreTargetFramework(tfmShortNames: string[]): string | undefined {
    return findNetCoreAppTargetFramework(tfmShortNames) ?? findModernNetFrameworkTargetFramework(tfmShortNames);
}

export function findNetCoreAppTargetFramework(tfmShortNames: string[]): string | undefined {
    return tfmShortNames.find((tf) => tf.startsWith('netcoreapp'));
}

export function findModernNetFrameworkTargetFramework(tfmShortNames: string[]): string | undefined {
    // Match modern .NET versions (5.0 and higher): net5.0, net6.0, net7.0, net8.0, net9.0, net10.0, net11.0, etc.
    // Pattern: ^net(\d+)\.0$ - starts with 'net', followed by digits, then '.0'
    // This matches net5.0, net10.0, net11.0, etc.
    const withDotRegexp = /^net(\d+)\.0$/;
    
    for (const tf of tfmShortNames) {
        const match = withDotRegexp.exec(tf);
        if (match) {
            const version = parseInt(match[1], 10);
            // Modern .NET starts at version 5
            if (version >= 5) {
                return tf;
            }
        }
    }

    // Also check for shortnames without dot: net50, net60, net70, net80, net90, net100, net110, etc.
    // Pattern: ^net(\d+)$ - starts with 'net', followed by only digits (no dot)
    const withoutDotRegexp = /^net(\d+)$/;
    
    for (const tf of tfmShortNames) {
        const match = withoutDotRegexp.exec(tf);
        if (match) {
            const versionStr = match[1];
            const version = parseInt(versionStr, 10);
            
            // Modern .NET without dot: net50 (5.0), net60 (6.0), ..., net100 (10.0), net110 (11.0)
            // These are reported as net + (version * 10), so they're always multiples of 10
            // This excludes legacy .NET Framework like net461 (4.6.1), net472 (4.7.2), etc.
            if (version >= 50 && version % 10 === 0) {
                const actualVersion = version / 10;
                return `net${actualVersion}.0`;
            }
        }
    }

    return undefined;
}

export function findNetStandardTargetFramework(tfmShortNames: string[]): string | undefined {
    return tfmShortNames.find((tf) => tf.startsWith('netstandard'));
}

export function isWebProject(projectPath: string): boolean {
    const projectFileText = fs.readFileSync(projectPath, 'utf8');

    // Assume that this is an MSBuild project. In that case, look for the 'Sdk="Microsoft.NET.Sdk.Web"' attribute.
    // TODO: Have OmniSharp provide the list of SDKs used by a project and check that list instead.
    return projectFileText.toLowerCase().indexOf('sdk="microsoft.net.sdk.web"') >= 0;
}

export async function isBlazorWebAssemblyProject(projectPath: string): Promise<boolean> {
    const projectDirectory = path.dirname(projectPath);
    const launchSettingsPath = path.join(projectDirectory, 'Properties', 'launchSettings.json');

    try {
        if (!fs.pathExistsSync(launchSettingsPath)) {
            return false;
        }

        const launchSettingContent = fs.readFileSync(launchSettingsPath);
        if (!launchSettingContent) {
            return false;
        }

        if (launchSettingContent.indexOf('"inspectUri"') > 0) {
            return true;
        }
    } catch {
        // Swallow IO errors from reading the launchSettings.json files
    }

    return false;
}

export function isBlazorWebAssemblyHosted(
    isExeProject: boolean,
    isWebProject: boolean,
    isProjectBlazorWebAssemblyProject: boolean,
    targetsDotnetCore: boolean
): boolean {
    if (!isProjectBlazorWebAssemblyProject) {
        return false;
    }

    if (!isExeProject) {
        return false;
    }

    if (!isWebProject) {
        return false;
    }

    if (targetsDotnetCore) {
        return false;
    }

    return true;
}
