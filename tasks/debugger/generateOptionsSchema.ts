/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as optionsSchemaGenerator from '../../src/tools/generateOptionsSchema.js';
import { runTask } from '../runTask.js';

runTask(optionsSchemaGenerator.GenerateOptionsSchema);
