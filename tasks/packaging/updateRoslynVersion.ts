/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
    acquireNugetPackage,
    allNugetPackages,
    installDependencies,
    updateNugetPackageVersion,
} from './offlinePackagingTasks';
import { runTask } from '../runTask';
import { getPackageJSON } from '../packageJson';

runTask(updateRoslynVersion);

// Defines a special task to acquire all the platform specific Roslyn packages.
// All packages need to be saved to the consumption AzDo artifacts feed, for non-platform
// specific packages this only requires running the installDependencies tasks.  However for Roslyn packages
// we need to acquire the nuget packages once for each platform to ensure they get saved to the feed.
async function updateRoslynVersion(): Promise<void> {
    // Fetch all platform-specific packages, then also installDependencies after
    await updateNugetPackageVersion(allNugetPackages.roslyn);

    // Also pull in the Roslyn DevKit dependencies nuget package.
    await acquireNugetPackage(allNugetPackages.roslynDevKit, undefined, getPackageJSON(), true);

    await installDependencies(/* clean */ true);
}
