/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as optionsSchemaGenerator from '../../src/tools/generateOptionsSchema';
import { runTask } from '../runTask';

runTask(optionsSchemaGenerator.GenerateOptionsSchema);
