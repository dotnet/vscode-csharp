/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as packageDependencyUpdater from '../../src/tools/updatePackageDependencies.ts';
import { runTask } from '../runTask.ts';

runTask(packageDependencyUpdater.updatePackageDependencies);
