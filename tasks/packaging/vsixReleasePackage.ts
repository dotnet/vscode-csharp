/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { parseArgs } from 'util';
import { VsixReleasePackageOptions, vsixReleasePackageTask } from './offlinePackagingTasks';
import { runTask } from '../runTask';
import { rootPath } from '../projectPaths';

const { values } = parseArgs({
    options: {
        prerelease: { type: 'boolean' },
        outputFolder: { type: 'string', short: 'o' },
        codeExtensionPath: { type: 'string' },
    },
    strict: true,
});

const options: VsixReleasePackageOptions = {
    prerelease: values.prerelease ?? false,
    outputFolder: path.resolve(values.outputFolder ?? path.join(rootPath, 'vsix')),
    codeExtensionPath: path.resolve(values.codeExtensionPath ?? rootPath),
};

runTask(async () => await vsixReleasePackageTask(options));
