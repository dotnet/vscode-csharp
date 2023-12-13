/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { commandLineOptions } from './commandLineArguments';

export const rootPath = path.resolve(__dirname, '..');

const nodeModulesPath = path.join(rootPath, 'node_modules');
export const vscePath = path.join(nodeModulesPath, '@vscode', 'vsce', 'vsce');
export const jestPath = path.join(nodeModulesPath, 'jest', 'bin', 'jest');

export const packedVsixOutputRoot = commandLineOptions.outputFolder || path.join(rootPath, 'vsix');
export const nugetTempPath = path.join(rootPath, 'out', '.nuget');
export const languageServerDirectory = path.join(rootPath, '.roslyn');
export const devKitDependenciesDirectory = path.join(rootPath, '.roslynDevKit');

export const codeExtensionPath = commandLineOptions.codeExtensionPath || rootPath;

export const omnisharpTestRootPath = path.join(rootPath, 'out', 'omnisharptest');
export const omnisharpFeatureTestRunnerPath = path.join(omnisharpTestRootPath, 'runFeatureTests.js');

export const outPath = path.join(rootPath, 'out');

export const nodePath = path.join(process.env.NVM_BIN ? `${process.env.NVM_BIN}${path.sep}` : '', 'node');
