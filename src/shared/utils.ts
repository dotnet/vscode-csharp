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

    // Also check for shortnames without dot: net50, net60, net70, net80, and net90.
    // Pattern: ^net(\d+)$ - starts with 'net', followed by only digits (no dot)
    const withoutDotRegexp = /^net(\d+)$/;

    for (const tf of tfmShortNames) {
        const match = withoutDotRegexp.exec(tf);
        if (match) {
            const versionStr = match[1];
            const version = parseInt(versionStr, 10);

            // Modern .NET without dot: net50 (5.0), net60 (6.0), ..., net90 (9.0)
            // These are reported as net + (version * 10), so they're always multiples of 10
            // This excludes legacy .NET Framework like net461 (4.6.1), net472 (4.7.2), etc.
            if (version >= 50 && version <= 90 && version % 10 === 0) {
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

export function isWebProject(projectPath: string): [boolean, boolean] {
    const projectFileText = fs.readFileSync(projectPath, 'utf8').toLowerCase();

    // Assume that this is an MSBuild project. In that case, look for the 'Sdk="Microsoft.NET.Sdk.Web"' attribute.
    // TODO: Have OmniSharp provide the list of SDKs used by a project and check that list instead.
    return [
        projectFileText.indexOf('sdk="microsoft.net.sdk.web"') >= 0,
        projectFileText.indexOf('sdk="microsoft.net.sdk.blazorwebassembly"') >= 0,
    ];
}

/**
 * Escape hatch: an explicit `enableWebAssemblyDebugging` flag on a launchSettings.json profile
 * unconditionally signals that the project requires Blazor WebAssembly (browser) debugging.
 *
 * The templates don't set this by default; it exists so users can force WebAssembly debugging on
 * when the static heuristics below don't recognize a non-standard project layout.
 */
export function hasEnableWebAssemblyDebuggingSetting(projectPath: string): boolean {
    const projectDirectory = path.dirname(projectPath);
    const launchSettingsPath = path.join(projectDirectory, 'Properties', 'launchSettings.json');

    try {
        if (!fs.pathExistsSync(launchSettingsPath)) {
            return false;
        }

        const launchSettingsContent = fs.readFileSync(launchSettingsPath, 'utf8');
        if (!launchSettingsContent) {
            return false;
        }

        try {
            const launchSettings = JSON.parse(launchSettingsContent);
            const profiles = launchSettings?.profiles;
            if (profiles && typeof profiles === 'object') {
                for (const profileName of Object.keys(profiles)) {
                    if (profiles[profileName]?.enableWebAssemblyDebugging === true) {
                        return true;
                    }
                }
            }
        } catch {
            // launchSettings.json may contain comments or otherwise fail to parse strictly; fall back
            // to a lenient text match so the escape hatch still works.
            return /"enableWebAssemblyDebugging"\s*:\s*true/i.test(launchSettingsContent);
        }
    } catch {
        // Swallow IO errors from reading the launchSettings.json files.
    }

    return false;
}

/**
 * Returns true when the project references Microsoft.AspNetCore.Components.WebAssembly.Server, the
 * package that brings in the Blazor WebAssembly debugging middleware. This is the static marker of
 * an ASP.NET Core host that serves and debugs a Blazor WebAssembly client.
 */
function referencesWebAssemblyServerPackage(projectPath: string): boolean {
    try {
        const projectFileText = fs.readFileSync(projectPath, 'utf8').toLowerCase();
        return projectFileText.indexOf('microsoft.aspnetcore.components.webassembly.server') >= 0;
    } catch {
        // Swallow IO errors from reading the project file.
        return false;
    }
}

/**
 * Classifies a project as a standalone or hosted Blazor WebAssembly app for debugging purposes.
 *
 * Detection relies on static, project-code based signals, plus the `enableWebAssemblyDebugging`
 * launchSettings.json escape hatch for non-standard layouts:
 * - Hosted: an executable Web SDK project that references the WebAssembly.Server package (or that
 *   has the escape hatch set).
 * - Standalone: a Blazor WebAssembly SDK project (or a non-host project with the escape hatch set).
 */
export function getBlazorWebAssemblyDebugInfo(
    projectPath: string,
    isExeProject: boolean,
    isWebSdkProject: boolean,
    isWebAssemblySdkProject: boolean
): { isBlazorWebAssemblyHosted: boolean; isBlazorWebAssemblyStandalone: boolean } {
    const forceWebAssemblyDebugging = hasEnableWebAssemblyDebuggingSetting(projectPath);

    const isBlazorWebAssemblyHosted =
        isExeProject &&
        isWebSdkProject &&
        (referencesWebAssemblyServerPackage(projectPath) || forceWebAssemblyDebugging);

    const isBlazorWebAssemblyStandalone =
        !isBlazorWebAssemblyHosted && (isWebAssemblySdkProject || forceWebAssemblyDebugging);

    return { isBlazorWebAssemblyHosted, isBlazorWebAssemblyStandalone };
}
