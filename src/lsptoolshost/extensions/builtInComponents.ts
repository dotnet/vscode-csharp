/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import { LanguageServerOptions } from '../../shared/options';

interface ComponentInfo {
    defaultFolderName: string;
    optionName: string;
    componentDllPaths: string[];
}

export const componentInfo: { [key: string]: ComponentInfo } = {
    roslynDevKit: {
        defaultFolderName: '.roslynDevKit',
        optionName: 'roslynDevKit',
        componentDllPaths: ['Microsoft.VisualStudio.LanguageServices.DevKit.dll'],
    },
    xamlTools: {
        defaultFolderName: '.xamlTools',
        optionName: 'xamlTools',
        componentDllPaths: [
            'Microsoft.VisualStudio.DesignTools.CodeAnalysis.dll',
            'Microsoft.VisualStudio.DesignTools.CodeAnalysis.Diagnostics.dll',
        ],
    },
    razorDevKit: {
        defaultFolderName: '.razorDevKit',
        optionName: 'razorDevKit',
        componentDllPaths: ['Microsoft.VisualStudio.DevKit.Razor.dll'],
    },
    razorExtension: {
        defaultFolderName: '.razorExtension',
        optionName: 'razorExtension',
        componentDllPaths: ['Microsoft.VisualStudioCode.RazorExtension.dll'],
    },
    roslynCopilot: {
        defaultFolderName: '.roslynCopilot',
        optionName: 'roslynCopilot',
        componentDllPaths: ['Microsoft.VisualStudio.Copilot.Roslyn.LanguageServer.dll'],
    },
};

export function getComponentPaths(componentName: string, options: LanguageServerOptions | undefined): string[] {
    const component = componentInfo[componentName];
    const baseFolder = getComponentFolderPath(component, options);
    const paths = component.componentDllPaths.map((dllPath) => path.join(baseFolder, dllPath));
    for (const dllPath of paths) {
        if (!fs.existsSync(dllPath)) {
            throw new Error(`Component DLL not found: ${dllPath}`);
        }
    }

    return paths;
}

export function getComponentFolder(componentName: string, options: LanguageServerOptions | undefined): string {
    const component = componentInfo[componentName];
    return getComponentFolderPath(component, options);
}

function getComponentFolderPath(component: ComponentInfo, options: LanguageServerOptions | undefined): string {
    if (options?.componentPaths) {
        const optionValue = options.componentPaths[component.optionName];
        if (optionValue) {
            return optionValue;
        }
    }

    return path.join(__dirname, '..', component.defaultFolderName);
}
