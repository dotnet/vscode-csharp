/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import path from 'path';
import { rootPath } from '../projectPaths';
import { execDotnet } from './signingTasks';
import { runTask } from '../runTask';

runTask(installSignPlugin);

async function installSignPlugin(): Promise<void> {
    console.log(`Installing MicroBuild.Plugins.Signing`);
    await execDotnet([
        'restore',
        path.join(rootPath, 'msbuild', 'server'),
        // MicroBuild is expecting the signing plugin to be in the global package folder, so ensure it gets downloaded there.
        `/p:DownloadToGlobalNugetFolder=true`,
        `/p:PackageName=MicroBuild.Plugins.Signing`,
        `/p:PackageVersion=1.1.950`,
        `/p:RestoreSources=https://dnceng.pkgs.visualstudio.com/_packaging/MicroBuildToolset/nuget/v3/index.json`,
    ]);
}
