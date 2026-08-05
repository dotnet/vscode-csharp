/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { parseArgs } from 'util';
import { vsixReleasePackageTask } from './offlinePackagingTasks';
import { runTask } from '../runTask';

const { values } = parseArgs({
    options: {
        prerelease: { type: 'boolean' },
    },
});
runTask(async () => await vsixReleasePackageTask(values.prerelease ?? false));
