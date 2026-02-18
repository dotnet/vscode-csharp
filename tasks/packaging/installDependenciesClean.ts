/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { installDependencies } from './offlinePackagingTasks';
import { runTask } from '../runTask';

runTask(async () => installDependencies(/* clean */ true));
