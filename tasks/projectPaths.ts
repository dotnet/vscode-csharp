/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { commandLineOptions } from './commandLineArguments';
import { componentInfo } from '../src/lsptoolshost/extensions/builtInComponents';

export const rootPath = path.resolve(__dirname, '..');

const nodeModulesPath = path.join(rootPath, 'node_modules');
export const vscePath = path.join(nodeModulesPath, '@vscode', 'vsce', 'vsce');
export const jestPath = path.join(nodeModulesPath, 'jest', 'bin', 'jest');

export const packedVsixOutputRoot = commandLineOptions.outputFolder || path.join(rootPath, 'vsix');
export const nugetTempPath = path.join(rootPath, 'out', '.nuget');
export const languageServerDirectory = path.join(rootPath, '.roslyn');
export const devKitDependenciesDirectory = path.join(rootPath, componentInfo.roslynDevKit.defaultFolderName);
export const xamlToolsDirectory = path.join(rootPath, componentInfo.xamlTools.defaultFolderName);
export const razorLanguageServerDirectory = path.join(rootPath, '.razor');
export const razorDevKitDirectory = path.join(rootPath, componentInfo.razorDevKit.defaultFolderName);
export const razorExtensionDirectory = path.join(rootPath, componentInfo.razorExtension.defaultFolderName);

export const codeExtensionPath = commandLineOptions.codeExtensionPath || rootPath;

export const omnisharpTestRootPath = path.join(rootPath, 'out', 'omnisharptest');
export const omnisharpFeatureTestRunnerPath = path.join(omnisharpTestRootPath, 'runFeatureTests.js');

export const outPath = path.join(rootPath, 'out');

export const nodePath = path.join(process.env.NVM_BIN ? `${process.env.NVM_BIN}${path.sep}` : '', 'node');
