/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as os from 'os';
import { Package } from '../packageManager/Package';
import { DownloadFile } from '../packageManager/FileDownloader';
import { EventStream } from '../EventStream';
import * as Event from "../omnisharp/loggingEvents";
import NetworkSettings, { NetworkSettingsProvider } from '../NetworkSettings';
import { getBufferIntegrityHash } from '../packageManager/isValidDownload';

interface PackageJSONFile
{
    runtimeDependencies : Package[];
}

export async function updatePackageDependencies() : Promise<void> {

    const newPrimaryUrls = process.env["NEW_DEPS_URLS"];
    const newVersion = process.env["NEW_DEPS_VERSION"];
    
    if (!newPrimaryUrls || !newVersion) {
        console.log();
        console.log("'npm run gulp updatePackageDependencies' will update package.json with new URLs of dependencies.");
        console.log();
        console.log("To use:");
        const setEnvVarPrefix = os.platform() === 'win32' ? "set " : "export ";
        const setEnvVarQuote = os.platform() === 'win32' ? "" : "\'";
        console.log(`  ${setEnvVarPrefix}NEW_DEPS_URLS=${setEnvVarQuote}https://example1/foo-osx.zip,https://example1/foo-win.zip,https://example1/foo-linux.zip${setEnvVarQuote}`);
        console.log(`  ${setEnvVarPrefix}NEW_DEPS_VERSION=${setEnvVarQuote}1.2.3${setEnvVarQuote}`);
        console.log("  npm run gulp updatePackageDependencies");
        console.log();
        return;
    }

    const newPrimaryUrlArray = newPrimaryUrls.split(',');
    for (let urlToUpdate of newPrimaryUrlArray) {
        if (!urlToUpdate.startsWith("https://")) {
            throw new Error("Unexpected 'NEW_DEPS_URLS' value. All URLs should start with 'https://'.");
        }
    }

    if (! /^[0-9]+\.[0-9]+\.[0-9]+$/.test(newVersion)) {
        throw new Error("Unexpected 'NEW_DEPS_VERSION' value. Expected format similar to: 1.2.3.");
    }
   
    let packageJSON: PackageJSONFile = JSON.parse(fs.readFileSync('package.json').toString());
    
    // map from lowercase filename to Package
    const mapFileNameToDependency: { [key: string]: Package } = {};

    // First build the map
    packageJSON.runtimeDependencies.forEach(dependency => {
        let fileName = getLowercaseFileNameFromUrl(dependency.url);
        let existingDependency = mapFileNameToDependency[fileName];
        if (existingDependency !== undefined) {
            throw new Error(`Multiple dependencies found with filename '${fileName}': '${existingDependency.url}' and '${dependency.url}'.`);
        }
        mapFileNameToDependency[fileName] = dependency;
    });
    
    let findDependencyToUpdate = (url : string): Package => {
        let fileName = getLowercaseFileNameFromUrl(url);
        let dependency = mapFileNameToDependency[fileName];
        if (dependency === undefined) {
            throw new Error(`Unable to update item for url '${url}'. No 'runtimeDependency' found with filename '${fileName}'.`);
        }
        return dependency;
    };

    const dottedVersionRegExp = /[0-9]+\.[0-9]+\.[0-9]+/g;
    const dashedVersionRegExp = /[0-9]+-[0-9]+-[0-9]+/g;
    
    const getMatchCount = (regexp: RegExp, searchString: string) : number => {
        regexp.lastIndex = 0;
        let retVal = 0;
        while (regexp.test(searchString)) {
            retVal++;
        }
        regexp.lastIndex = 0;
        return retVal;
    };

    // First quickly make sure we could match up the URL to an existing item.
    for (let urlToUpdate of newPrimaryUrlArray) {
        const dependency = findDependencyToUpdate(urlToUpdate);
        if (dependency.fallbackUrl) {
            const dottedMatches : number = getMatchCount(dottedVersionRegExp, dependency.fallbackUrl);
            const dashedMatches : number = getMatchCount(dashedVersionRegExp, dependency.fallbackUrl);
            const matchCount : number = dottedMatches + dashedMatches;

            if (matchCount == 0) {
                throw new Error(`Version number not found in fallback URL '${dependency.fallbackUrl}'.`);
            }
            if (matchCount > 1) {
                throw new Error(`Ambiguous version pattern found in fallback URL '${dependency.fallbackUrl}'. Multiple version strings found.`);
            }
        }
    }

    // Next take another pass to try and update to the URL  
    const eventStream = new EventStream();
    eventStream.subscribe((event: Event.BaseEvent) => {
        switch (event.constructor.name) {
            case Event.DownloadFailure.name:
                console.log("Failed to download: " + (<Event.DownloadFailure>event).message);
                break;
        }
    });
    const networkSettingsProvider : NetworkSettingsProvider = () => new NetworkSettings(/*proxy:*/ null, /*stringSSL:*/ true);

    const downloadAndGetHash = async (url:string) : Promise<string> => {
        console.log(`Downlodaing from '${url}'`);
        const buffer : Buffer = await DownloadFile(url, eventStream, networkSettingsProvider, url, null);
        return getBufferIntegrityHash(buffer);
    };

    for (let urlToUpdate of newPrimaryUrlArray) {
        let dependency = findDependencyToUpdate(urlToUpdate);
        dependency.url = urlToUpdate;
        dependency.integrity = await downloadAndGetHash(dependency.url);

        if (dependency.fallbackUrl) {
            
            // NOTE: We already verified in the first loop that one of these patterns will work, grab the one that does
            let regex: RegExp = dottedVersionRegExp;
            let newValue: string = newVersion;
            if (!dottedVersionRegExp.test(dependency.fallbackUrl)) {
                regex = dashedVersionRegExp;
                newValue = newVersion.replace(/\./g, "-");
            }
            dottedVersionRegExp.lastIndex = 0;

            dependency.fallbackUrl = dependency.fallbackUrl.replace(regex, newValue);
            const fallbackUrlIntegrity = await downloadAndGetHash(dependency.fallbackUrl);

            if (dependency.integrity !== fallbackUrlIntegrity) {
                throw new Error(`File downloaded from primary URL '${dependency.url}' doesn't match '${dependency.fallbackUrl}'.`);
            }
        }
    }

    let content = JSON.stringify(packageJSON, null, 2);
    if (os.platform() === 'win32') {
        content = content.replace(/\n/gm, "\r\n");
    }

    // We use '\u200b' (unicode zero-length space character) to break VS Code's URL detection regex for URLs that are examples. This process will
    // convert that from the readable espace sequence, to just an invisible character. Convert it back to the visible espace sequence.
    content = content.replace(/\u200b/gm, "\\u200b");

    fs.writeFileSync('package.json', content);
}

function getLowercaseFileNameFromUrl(url : string) : string {

    if (!url.startsWith("https://")) {
        throw new Error(`Unexpected URL '${url}'. URL expected to start with 'https://'.`);
    }

    if (!url.endsWith(".zip")) {
        throw new Error(`Unexpected URL '${url}'. URL expected to end with '.zip'.`);
    }

    let index = url.lastIndexOf("/");
    return url.substr(index + 1).toLowerCase();    
}