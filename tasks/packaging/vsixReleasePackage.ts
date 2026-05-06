/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import minimist from 'minimist';
import { vsixReleasePackageTask } from './offlinePackagingTasks';
import { runTask } from '../runTask';

const argv = minimist(process.argv.slice(2));
runTask(async () => await vsixReleasePackageTask(!!argv.prerelease));
