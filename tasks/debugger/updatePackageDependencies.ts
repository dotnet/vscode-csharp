/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { updatePackageDependenciesTask } from './debuggerTasks';
import { runTask } from '../runTask';

runTask(updatePackageDependenciesTask);
