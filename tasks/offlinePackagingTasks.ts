
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as del from 'del';
import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import * as gulp from 'gulp';
import * as util from 'util';
import { Logger } from '../src/logger';
import { PlatformInformation } from '../src/platform';
import { CsharpLoggerObserver } from '../src/observers/CsharpLoggerObserver';
import { EventStream } from '../src/EventStream';
import NetworkSettings from '../src/NetworkSettings';
import { downloadAndInstallPackages } from '../src/packageManager/downloadAndInstallPackages';
import { getRuntimeDependenciesPackages } from '../src/tools/RuntimeDependencyPackageUtils';
import { getAbsolutePathPackagesToInstall } from '../src/packageManager/getAbsolutePathPackagesToInstall';
import { commandLineOptions } from '../tasks/commandLineArguments';
import { codeExtensionPath, offlineVscodeignorePath, vscodeignorePath, packedVsixOutputRoot, languageServerDirectory, getServerPublishDirectory } from '../tasks/projectPaths';
import { getPackageJSON } from '../tasks/packageJson';
import { createPackageAsync } from '../tasks/vsceTasks';
import { isValidDownload } from '../src/packageManager/isValidDownload';
const argv = require('yargs').argv;
const exec = util.promisify(cp.exec);

// Mapping of vsce vsix packaging target to the RID used to build the server executable
export const platformSpecificPackages = [
    { vsceTarget: "win32-x64", rid: "win-x64", platformInfo: new PlatformInformation('win32', 'x86_64') },
    { vsceTarget: "win32-ia32", rid: "win-x86", platformInfo: new PlatformInformation('win32', 'x86') },
    { vsceTarget: "win32-arm64", rid: "win-arm64", platformInfo: new PlatformInformation('win32', 'arm64') },
    { vsceTarget: "linux-x64", rid: "linux-x64", platformInfo: new PlatformInformation('linux', 'x86_64') },
    { vsceTarget: "linux-arm64", rid: "linux-arm64", platformInfo: new PlatformInformation('linux', 'arm64') },
    { vsceTarget: "alpine-x64", rid: "alpine-x64", platformInfo: new PlatformInformation('linux-musl', 'x86_64') },
    { vsceTarget: "alpine-arm64", rid: "alpine-arm64", platformInfo: new PlatformInformation('linux-musl', 'arm64') },
    { vsceTarget: "darwin-x64", rid: "osx-x64", platformInfo: new PlatformInformation('darwin', 'x86_64') },
    { vsceTarget: "darwin-arm64", rid: "osx-arm64", platformInfo: new PlatformInformation('darwin', 'arm64') }
];

export function getPackageName(packageJSON: any, vscodePlatformId?: string) {
    const name = packageJSON.name;
    const version = packageJSON.version;

    if (vscodePlatformId) {
        return `${name}-${version}-${vscodePlatformId}.vsix`;
    } else {
        return `${name}-${version}.vsix`;
    }
}

gulp.task('server:publish', async () => {
    let configuration = argv.configuration ?? 'Debug';
    
    // Publish all platform specific server bits.
    for (let platform of platformSpecificPackages) {
        await publishServer(configuration, platform.rid);
    }

    // Publish a platform neutral server as well.
    await publishServer(configuration);
});

gulp.task('vsix:release:package', async () => {

    //if user does not want to clean up the existing vsix packages
    await cleanAsync(/* deleteVsix: */ !commandLineOptions.retainVsix);

    del.sync(vscodeignorePath);

    fs.copyFileSync(offlineVscodeignorePath, vscodeignorePath);

    try {
        await doPackageOffline();
    }
    finally {
        del(vscodeignorePath);
    }
});

// Downloads Razor language server bits for local development
gulp.task('razor:languageserver', async () => {
    await del('.razor');

    const packageJSON = getPackageJSON();
    const platform = await PlatformInformation.GetCurrent();

    try {
        await installRazor(platform, packageJSON);
    }
    catch (err) {
        const message = (err instanceof Error ? err.stack : err) ?? '<unknown error>';
        // NOTE: Extra `\n---` at the end is because gulp will print this message following by the
        // stack trace of this line. So that seperates the two stack traces.
        throw Error(`Failed to install packages for ${platform}. ${message}\n---`);
    }
});

// Install Tasks
async function installRazor(platformInfo: PlatformInformation, packageJSON: any) {
    let eventStream = new EventStream();
    const logger = new Logger(message => process.stdout.write(message));
    let stdoutObserver = new CsharpLoggerObserver(logger);
    eventStream.subscribe(stdoutObserver.post);
    let runTimeDependencies = getRuntimeDependenciesPackages(packageJSON)
        .filter(dep => (dep.isFramework === undefined || !dep.isFramework) && dep.id === "Razor");
    let packagesToInstall = await getAbsolutePathPackagesToInstall(runTimeDependencies, platformInfo, codeExtensionPath);
    let provider = () => new NetworkSettings('', true);
    if (!(await downloadAndInstallPackages(packagesToInstall, provider, eventStream, isValidDownload))) {
        throw Error("Failed to download package.");
    }
}

async function publishServer(configuration: string, rid?: string) {
    let dotnetArgs = [];
    dotnetArgs.push('dotnet', 'publish', './server/Microsoft.CodeAnalysis.LanguageServer/', '--configuration', configuration);
    if (rid) {
        dotnetArgs.push('-r', rid, '-p:PublishReadyToRun=true');
    }

    let command = dotnetArgs.join(" ");
    console.log(command);
    const { stdout } = await exec(dotnetArgs.join(" "));
    console.log(`stdout: ${stdout}`);
}

async function doPackageOffline() {

    const packageJSON = getPackageJSON();

    for (let p of platformSpecificPackages) {
        try {
            if (process.platform === 'win32' && !p.rid.startsWith('win')) {
                console.warn(`Skipping packaging for ${p.rid} on Windows since runtime executables will not be marked executable in *nix packages.`);
                continue;
            }

            await buildVsix(packageJSON, packedVsixOutputRoot, p.rid, p.vsceTarget, p.platformInfo);
        }
        catch (err) {
            const message = (err instanceof Error ? err.stack : err) ?? '<unknown error>';
            // NOTE: Extra `\n---` at the end is because gulp will print this message following by the
            // stack trace of this line. So that seperates the two stack traces.
            throw Error(`Failed to create package ${p.vsceTarget}. ${message}\n---`);
        }
    }

    // Also output the platform neutral VSIX using the platform neutral server bits we created before.
    await buildVsix(packageJSON, packedVsixOutputRoot, "neutral");

}

async function cleanAsync(deleteVsix: boolean) {
    await del(['install.*', '.omnisharp*', '.debugger', '.razor', languageServerDirectory]);

    if (deleteVsix) {
        await del('*.vsix');
    }
}

async function buildVsix(packageJSON: any, outputFolder: string, publishFolder: string, vsceTarget?: string, platformInfo?: PlatformInformation) {
    await cleanAsync(false);

    if (platformInfo != null) {
        await installRazor(platformInfo, packageJSON);
    }

    const packageFileName = getPackageName(packageJSON, vsceTarget);
    await copyServerToExtensionDirectory(publishFolder);
    await createPackageAsync(outputFolder, packageFileName, vsceTarget);
}

/**
 * This takes care of copying the server bits from the build directory
 * to the location that the extension looks for to activate it.
 */
async function copyServerToExtensionDirectory(publishFolder: string)
{
    if (!fs.existsSync(languageServerDirectory))
    {
        fs.mkdirSync(languageServerDirectory);
    }

    let configuration = argv.configuration ?? "Debug";
    let serverBuildDirectory = getServerPublishDirectory(configuration, publishFolder);

    if (!fs.existsSync(serverBuildDirectory))
    {
        throw new Error(`Did not find expected server bits at ${serverBuildDirectory}`);
    }

    fsextra.copySync(serverBuildDirectory, languageServerDirectory);
}