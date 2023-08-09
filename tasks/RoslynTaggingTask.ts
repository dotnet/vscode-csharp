/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as xml2js from 'xml2js';
import * as fs from 'fs';
import * as axios from 'axios';

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

    const languageServerPackageName = 'Microsoft.CodeAnalysis.LanguageServer';

});

interface nugetConfig {
    configu1
}

async function HttpsGetAsync(url: string) : Promise<string> {
    const request = https.get(url,);
}

function LogError(message: string): void {
    console.log(`##vso[task.logissue type=error]${message}`);
}
