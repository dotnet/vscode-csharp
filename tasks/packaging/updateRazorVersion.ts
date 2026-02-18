/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { acquireNugetPackage, allNugetPackages, installDependencies } from './offlinePackagingTasks';
import { getPackageJSON } from '../packageJson';
import { runTask } from '../runTask';

runTask(updateRazorVersion);

// Defines a special task to acquire all the platform specific Razor packages.
// All packages need to be saved to the consumption AzDo artifacts feed, for non-platform
// specific packages this only requires running the installDependencies tasks.  However for Razor packages
// we need to acquire the nuget packages once for each platform to ensure they get saved to the feed.
async function updateRazorVersion(): Promise<void> {
    // Pull in the .razorExtension code that gets loaded in the roslyn language server
    await acquireNugetPackage(allNugetPackages.razorExtension, undefined, getPackageJSON(), true);

    await installDependencies();
}
