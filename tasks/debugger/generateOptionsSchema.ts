/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { generateOptionsSchemaTask } from './debuggerTasks';
import { runTask } from '../runTask';

runTask(generateOptionsSchemaTask);
