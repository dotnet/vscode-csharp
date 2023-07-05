/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as os from 'os';
import { Package } from '../packageManager/package';
import { DownloadFile } from '../packageManager/fileDownloader';
import { EventStream } from '../eventStream';
import * as Event from '../omnisharp/loggingEvents';
import NetworkSettings, { NetworkSettingsProvider } from '../networkSettings';
import { getBufferIntegrityHash } from '../packageManager/isValidDownload';
import { EventType } from '../omnisharp/eventType';

interface PackageJSONFile {
    runtimeDependencies: Package[];
    defaults: {
        [key: string]: string;
    };
}

const dottedVersionRegExp = /[0-9]+\.[0-9]+\.[0-9]+[-a-zA-Z0-9.]*/g;
const dashedVersionRegExp = /[0-9]+-[0-9]+-[0-9]+/g;

export async function updatePackageDependencies(): Promise<void> {
    const newPrimaryUrls = process.env['NEW_DEPS_URLS'];
    const newVersion = process.env['NEW_DEPS_VERSION'];
    const packageId = process.env['NEW_DEPS_ID'];

    if ((!packageId && !newPrimaryUrls) || !newVersion) {
        console.log();
        console.log("'npm run gulp updatePackageDependencies' will update package.json with new URLs of dependencies.");
        console.log();
        console.log('To use:');
        const setEnvVarPrefix = os.platform() === 'win32' ? 'set ' : 'export ';
        const setEnvVarQuote = os.platform() === 'win32' ? '' : "'";
        console.log(
            `  ${setEnvVarPrefix}NEW_DEPS_URLS=${setEnvVarQuote}https://example1/foo-osx.zip,https://example1/foo-win.zip,https://example1/foo-linux.zip${setEnvVarQuote}`
        );
        console.log('-or-');
        console.log(`  ${setEnvVarPrefix}NEW_DEPS_ID=${setEnvVarQuote}Debugger${setEnvVarQuote}`);
        console.log('-and-');
        console.log(`  ${setEnvVarPrefix}NEW_DEPS_VERSION=${setEnvVarQuote}1.2.3${setEnvVarQuote}`);
        console.log('  npm run gulp updatePackageDependencies');
        console.log();
        return;
    }

    if (!/^[0-9]+\.[0-9]+\.[0-9]+[-a-zA-Z0-9.]*$/.test(newVersion)) {
        throw new Error("Unexpected 'NEW_DEPS_VERSION' value. Expected format similar to: 1.2.3.");
    }

    const packageJSON: PackageJSONFile = JSON.parse(fs.readFileSync('package.json').toString());

    const eventStream = new EventStream();
    eventStream.subscribe((event: Event.BaseEvent) => {
        switch (event.type) {
            case EventType.DownloadFailure:
                console.log('Failed to download: ' + (<Event.DownloadFailure>event).message);
                break;
        }
    });
    const networkSettingsProvider: NetworkSettingsProvider = () =>
        new NetworkSettings(/*proxy:*/ '', /*stringSSL:*/ true);

    const downloadAndGetHash = async (url: string): Promise<string> => {
        console.log(`Downloading from '${url}'`);
        const buffer: Buffer = await DownloadFile(url, eventStream, networkSettingsProvider, url);
        return getBufferIntegrityHash(buffer);
    };

    const updateDependency = async (dependency: Package): Promise<void> => {
        dependency.integrity = await downloadAndGetHash(dependency.url);
        dependency.fallbackUrl = replaceVersion(dependency.fallbackUrl, newVersion);
        dependency.installPath = replaceVersion(dependency.installPath, newVersion);
        dependency.installTestPath = replaceVersion(dependency.installTestPath, newVersion);
        Object.keys(packageJSON.defaults).forEach((key) => {
            //Update the version present in the defaults
            if (key.toLowerCase() == dependency.id.toLowerCase()) {
                packageJSON.defaults[key] = newVersion;
            }
        });

        if (dependency.fallbackUrl) {
            const fallbackUrlIntegrity = await downloadAndGetHash(dependency.fallbackUrl);
            if (dependency.integrity !== fallbackUrlIntegrity) {
                throw new Error(
                    `File downloaded from primary URL '${dependency.url}' doesn't match '${dependency.fallbackUrl}'.`
                );
            }
        }
    };

    if (newPrimaryUrls) {
        const newPrimaryUrlArray = newPrimaryUrls.split(',');
        for (const urlToUpdate of newPrimaryUrlArray) {
            if (!urlToUpdate.startsWith('https://')) {
                throw new Error("Unexpected 'NEW_DEPS_URLS' value. All URLs should start with 'https://'.");
            }
        }

        // map from lowercase filename to Package
        const mapFileNameToDependency: { [key: string]: Package } = {};

        // First build the map
        packageJSON.runtimeDependencies.forEach((dependency) => {
            const fileName = getLowercaseFileNameFromUrl(dependency.url);
            const existingDependency = mapFileNameToDependency[fileName];
            if (existingDependency !== undefined) {
                throw new Error(
                    `Multiple dependencies found with filename '${fileName}': '${existingDependency.url}' and '${dependency.url}'.`
                );
            }
            mapFileNameToDependency[fileName] = dependency;
        });

        const findDependencyToUpdate = (url: string): Package => {
            const fileName = getLowercaseFileNameFromUrl(url);
            const dependency = mapFileNameToDependency[fileName];
            if (dependency === undefined) {
                throw new Error(
                    `Unable to update item for url '${url}'. No 'runtimeDependency' found with filename '${fileName}'.`
                );
            }
            return dependency;
        };

        // First quickly make sure we could match up the URL to an existing item.
        for (const urlToUpdate of newPrimaryUrlArray) {
            const dependency = findDependencyToUpdate(urlToUpdate);
            //Fallback url should contain a version
            verifyVersionSubstringCount(dependency.fallbackUrl, true);
            verifyVersionSubstringCount(dependency.installPath);
            verifyVersionSubstringCount(dependency.installTestPath);
        }

        for (const urlToUpdate of newPrimaryUrlArray) {
            const dependency = findDependencyToUpdate(urlToUpdate);
            dependency.url = urlToUpdate;

            await updateDependency(dependency);
        }
    } else {
        let packageFound = false;
        // First quickly make sure that 'url' contains a version
        for (const dependency of packageJSON.runtimeDependencies) {
            if (dependency.id !== packageId) {
                continue;
            }
            packageFound = true;
            verifyVersionSubstringCount(dependency.url, true);
            verifyVersionSubstringCount(dependency.fallbackUrl, true);
            verifyVersionSubstringCount(dependency.installPath);
            verifyVersionSubstringCount(dependency.installTestPath);
        }
        if (!packageFound) {
            throw new Error(`Failed to find package with 'id' of '${packageId}'.`);
        }

        // Now update the versions
        for (const dependency of packageJSON.runtimeDependencies) {
            if (dependency.id !== packageId) {
                continue;
            }

            dependency.url = replaceVersion(dependency.url, newVersion);
            await updateDependency(dependency);
        }
    }

    let content = JSON.stringify(packageJSON, null, 2);
    if (os.platform() === 'win32') {
        content = content.replace(/\n/gm, '\r\n');
    }

    // We use '\u200b' (unicode zero-length space character) to break VS Code's URL detection regex for URLs that are examples. This process will
    // convert that from the readable espace sequence, to just an invisible character. Convert it back to the visible espace sequence.
    content = content.replace(/\u200b/gm, '\\u200b');

    fs.writeFileSync('package.json', content);
}

function replaceVersion(fileName: string, newVersion: string): string;
function replaceVersion(fileName: undefined, newVersion: string): undefined;
function replaceVersion(fileName: string | undefined, newVersion: string): string | undefined;
function replaceVersion(fileName: string | undefined, newVersion: string): string | undefined {
    if (fileName === undefined) {
        return undefined; // If the file name is undefined, no version to replace
    }

    let regex: RegExp = dottedVersionRegExp;
    let newValue: string = newVersion;
    if (!dottedVersionRegExp.test(fileName)) {
        regex = dashedVersionRegExp;
        newValue = newVersion.replace(/\./g, '-');
    }
    dottedVersionRegExp.lastIndex = 0;

    if (!regex.test(fileName)) {
        return fileName; // If the string doesn't contain any version return the same string
    }

    return fileName.replace(regex, newValue);
}

function verifyVersionSubstringCount(value: string | undefined, shouldContainVersion = false): void {
    if (value === undefined) {
        return;
    }

    const getMatchCount = (regexp: RegExp, searchString: string): number => {
        regexp.lastIndex = 0;
        let retVal = 0;
        while (regexp.test(searchString)) {
            retVal++;
        }
        regexp.lastIndex = 0;
        return retVal;
    };

    const dottedMatches = getMatchCount(dottedVersionRegExp, value);
    const dashedMatches = getMatchCount(dashedVersionRegExp, value);
    const matchCount = dottedMatches + dashedMatches;

    if (shouldContainVersion && matchCount === 0) {
        throw new Error(`Version number not found in '${value}'.`);
    }

    if (matchCount > 2) {
        throw new Error(`Ambiguous version pattern found in '${value}'. Multiple version strings found.`);
    }
}

function getLowercaseFileNameFromUrl(url: string): string {
    if (!url.startsWith('https://')) {
        throw new Error(`Unexpected URL '${url}'. URL expected to start with 'https://'.`);
    }

    if (!url.endsWith('.zip')) {
        throw new Error(`Unexpected URL '${url}'. URL expected to end with '.zip'.`);
    }

    const index = url.lastIndexOf('/');
    let fileName = url.substr(index + 1).toLowerCase();

    if (fileName.startsWith('omnisharp')) {
        // Omnisharp versions are always after the last '-'.
        // e.g. we want omnisharp-win-x86 from omnisharp-win-x86-1.39.3.zip
        const lastDash = fileName.lastIndexOf('-');
        fileName = fileName.substr(0, lastDash);
        return fileName;
    } else if (fileName.startsWith('coreclr-debug')) {
        // Debugger versions are not contained in the file name.
        return fileName;
    } else if (fileName.startsWith('razorlanguageserver')) {
        // Razor versions are everything after the second to last dash.
        // e.g. we want razorlanguageserver-win-x64 from razorlanguageserver-win-x64-7.0.0-preview.23067.5.zip
        const secondToLastDash = fileName.lastIndexOf('-', fileName.lastIndexOf('-') - 1);
        fileName = fileName.substr(0, secondToLastDash);
        return fileName;
    } else {
        throw new Error(`Unexpected dependency file name '${fileName}'`);
    }
}
