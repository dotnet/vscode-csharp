/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as xml2js from 'xml2js';
import * as fs from 'fs';
import axios from 'axios';

gulp.task('Tag release information to dotnet/roslyn', async () => {
    const packageJson = JSON.parse('../package.json');
    const roslynVersion = packageJson['defaults']['roslyn'];
    if (!roslynVersion) {
        LogError("Can't find roslyn version in package.json");
        return 1;
    }

    const nugetFile = fs.readFileSync('../server/NuGet.config');
    const nugetConfig = await xml2js.parseStringPromise(nugetFile);
    const nugetServerIndex = nugetConfig.configuration.packageSources.add[0].$['msft_consumption'];
    if (!nugetServerIndex) {
        LogError("Can't find nuget server index.");
        return 1;
    }

    // Find the matching commit from nuget server
    // 1. Ask the PackageBaseAddress from nuget server index.
    // 2. Download .nuspec file. See https://learn.microsoft.com/en-us/nuget/api/package-base-address-resource#download-package-manifest-nuspec
    // 3. Find the commit from .nuspec file
    const indexResponse = await axios.get(nugetServerIndex);
    if (indexResponse.status != 200) {
        LogError('Failed to get index file from nuget server');
        return 1;
    }

    console.log(`nuget index file: ${indexResponse.data}.`);
    const resources = indexResponse.data['resources'] as any[];
    // This is required to be implemented in nuget server.
    const packageBaseAddress = resources.find((res, _) => res['@type'] === 'PackageBaseAddress/3.0.0');
    const id = packageBaseAddress['@id'];

    const lowerCaselanguageServerPackageName = 'Microsoft.CodeAnalysis.LanguageServer'.toLocaleLowerCase();
    const nuspecGetUrl = `${id}/${lowerCaselanguageServerPackageName}/${roslynVersion}/${lowerCaselanguageServerPackageName}.nuspec`;
    const nuspecResponse = await axios.get(nuspecGetUrl);
    if (nuspecResponse.status != 200) {
        LogError('Failed to get nuspec file from nuget server');
        return 1;
    }

    console.log(`nuspect file: ${nugetConfig.data}.`);
    const nuspecFile = await xml2js.parseStringPromise(nuspecResponse.data);
    const repoUrl = nuspecFile.package.metadata.repository[0].$['url'];
    const commitNumber = nuspecFile.package.metadata.repository[0].$['commit'];
    console.log(`repoUrl is ${repoUrl}.`);
    console.log(`commitNumber is ${commitNumber}.`);
});

function LogError(message: string): void {
    console.log(`##vso[task.logissue type=error]${message}`);
}
