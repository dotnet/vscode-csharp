/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { copyFile, mkdir } from 'fs/promises';
import path from 'path';
import { outPath, rootPath } from '../projectPaths.ts';

const outputTestPath = path.join(outPath, 'test');
await mkdir(outputTestPath, { recursive: true });
await copyFile(path.join(rootPath, 'test', 'jestProjectNames.mjs'), path.join(outputTestPath, 'jestProjectNames.mjs'));
