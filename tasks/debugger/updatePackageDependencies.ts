/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as packageDependencyUpdater from '../../src/tools/updatePackageDependencies.js';
import { runTask } from '../runTask.js';

runTask(packageDependencyUpdater.updatePackageDependencies);
