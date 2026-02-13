/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { updateRazorVersionTask } from './offlinePackagingTasks';
import { runTask } from '../runTask';

runTask(updateRazorVersionTask);
