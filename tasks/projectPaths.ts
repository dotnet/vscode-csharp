/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { commandLineOptions } from './commandLineArguments';

export const rootPath = path.resolve(__dirname, '..');

const nodeModulesPath = path.join(rootPath, 'node_modules');
export const vscePath = path.join(nodeModulesPath, 'vsce', 'vsce');
export const mochaPath = path.join(nodeModulesPath, 'mocha', 'bin', 'mocha');

export const packedVsixOutputRoot = commandLineOptions.outputFolder || path.join(rootPath, "vsix");
export const nugetTempPath = path.join(rootPath, "out", ".nuget");
export const languageServerDirectory = path.join(rootPath, ".roslyn");

export const codeExtensionPath = commandLineOptions.codeExtensionPath || rootPath;

export const testRootPath = path.join(rootPath, "out", "test");
export const featureTestRunnerPath = path.join(testRootPath, "runFeatureTests.js");
export const integrationTestRunnerPath = path.join(testRootPath, "runIntegrationTests.js");
export const testAssetsRootPath = path.join(rootPath, "test", "integrationTests", "testAssets");

export const nodePath = path.join(process.env.NVM_BIN
    ? `${process.env.NVM_BIN}${path.sep}`
    : '', 'node');

