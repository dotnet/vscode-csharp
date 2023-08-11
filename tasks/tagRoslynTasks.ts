/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as xml2js from 'xml2js';
import * as fs from 'fs';
import axios from 'axios';
import minimist = require('minimist');

interface Options {
    releaseVersion: string;
}

gulp.task('tagRoslyn', async (): Promise<number> => {
    const vscodeCsharpVersion = minimist<Options>(process.argv.slice(2));
    console.log(`Release version: ${vscodeCsharpVersion.releaseVersion}`);
    const packageJsonString = fs.readFileSync('./package.json').toString();
    const packageJson = JSON.parse(packageJsonString);
    const roslynVersion = packageJson['defaults']['roslyn'];
    if (!roslynVersion) {
        LogError("Can't find roslyn version in package.json");
        return 1;
    }

    console.log(`Roslyn version is ${roslynVersion}`);
    const nugetFileString = fs.readFileSync('./server/NuGet.config').toString();
    const nugetConfig = await xml2js.parseStringPromise(nugetFileString);
    const nugetServerIndex = nugetConfig.configuration.packageSources[0].add[0].$.value;
    if (!nugetServerIndex) {
        LogError("Can't find nuget server index.");
        return 1;
    }

    console.log(`Nuget server index is ${nugetServerIndex}`);
    // Find the matching commit from nuget server
    // 1. Ask the PackageBaseAddress from nuget server index.
    // 2. Download .nuspec file. See https://learn.microsoft.com/en-us/nuget/api/package-base-address-resource#download-package-manifest-nuspec
    // 3. Find the commit from .nuspec file
    const indexResponse = await axios.get(nugetServerIndex);
    if (indexResponse.status != 200) {
        LogError('Failed to get index file from nuget server');
        return 1;
    }

    const resources = indexResponse.data['resources'] as any[];
    // This is required to be implemented in nuget server.
    const packageBaseAddress = resources.find((res, _) => res['@type'] === 'PackageBaseAddress/3.0.0');
    const id = packageBaseAddress['@id'];
    console.log(`packageBaseAddress is: ${id}`);

    const lowerCaseLanguageServerPackageName = 'Microsoft.CodeAnalysis.LanguageServer'.toLocaleLowerCase();
    const nuspecGetUrl = `${id}${lowerCaseLanguageServerPackageName}/${roslynVersion}/${lowerCaseLanguageServerPackageName}.nuspec`;
    console.log(`Url to get nuspec file is ${nuspecGetUrl}`);
    const nuspecResponse = await axios.get(nuspecGetUrl);
    if (nuspecResponse.status != 200) {
        LogError('Failed to get nuspec file from nuget server');
        return 1;
    }

    const nuspecFile = await xml2js.parseStringPromise(nuspecResponse.data);
    const repoUrl = nuspecFile.package.metadata[0].repository[0].$['url'];
    const commitNumber = nuspecFile.package.metadata[0].repository[0].$['commit'];
    console.log(`repoUrl is ${repoUrl}`);
    console.log(`commitNumber is ${commitNumber}`);
    return 0;
});

function LogError(message: string): void {
    console.log(`##vso[task.logissue type=error]${message}`);
}
