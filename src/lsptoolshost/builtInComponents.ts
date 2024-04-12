/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import { LanguageServerOptions } from '../shared/options';

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
            path.join('lib', 'netstandard2.0', 'Microsoft.VisualStudio.DesignTools.CodeAnalysis.dll'),
            path.join('lib', 'netstandard2.0', 'Microsoft.VisualStudio.DesignTools.CodeAnalysis.Diagnostics.dll'),
        ],
    },
};

export function getComponentPaths(componentName: string, options: LanguageServerOptions): string[] {
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

export function getComponentFolder(componentName: string, options: LanguageServerOptions): string {
    const component = componentInfo[componentName];
    return getComponentFolderPath(component, options);
}

function getComponentFolderPath(component: ComponentInfo, options: LanguageServerOptions): string {
    if (options.componentPaths) {
        const optionValue = options.componentPaths[component.optionName];
        if (optionValue) {
            return optionValue;
        }
    }

    return path.join(__dirname, '..', component.defaultFolderName);
}
