/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as xml2js from 'xml2js';
import * as fs from 'fs';
import axios, { AxiosResponse } from 'axios';
import * as minimist from 'minimist';
import { Octokit } from '@octokit/rest';

interface Options {
    releaseVersion: string;
    gitHubPat?: string;
}

gulp.task('createTags', async (): Promise<number> => {
    const options = minimist<Options>(process.argv.slice(2));
    console.log(`Release version: ${options.releaseVersion}`);

    const roslynCommit = await findRoslynCommitAsync();
    if (!roslynCommit) {
        logError('Failed to find roslyn commit.');
        return 1;
    }

    await tagRepoAsync(roslynCommit, options.gitHubPat);

    return 0;
});

async function findRoslynCommitAsync(): Promise<string | null> {
    const packageJsonString = fs.readFileSync('./package.json').toString();
    const packageJson = JSON.parse(packageJsonString);
    const roslynVersion = packageJson['defaults']['roslyn'];
    if (!roslynVersion) {
        logError("Can't find roslyn version in package.json");
        return null;
    }

    console.log(`Roslyn version is ${roslynVersion}`);
    const nugetFileString = fs.readFileSync('./server/NuGet.config').toString();
    const nugetConfig = await xml2js.parseStringPromise(nugetFileString);
    const nugetServerIndex = nugetConfig.configuration.packageSources[0].add[0].$.value;
    if (!nugetServerIndex) {
        logError("Can't find nuget server index.");
        return null;
    }

    console.log(`Nuget server index is ${nugetServerIndex}`);
    // Find the matching commit from nuget server
    // 1. Ask the PackageBaseAddress from nuget server index.
    // 2. Download .nuspec file. See https://learn.microsoft.com/en-us/nuget/api/package-base-address-resource#download-package-manifest-nuspec
    // 3. Find the commit from .nuspec file

    const indexResponse = await sendHttpsGetRequestAsync(nugetServerIndex);
    if (!indexResponse) {
        return null;
    }

    const resources = indexResponse.data['resources'] as any[];
    // This is required to be implemented in nuget server.
    const packageBaseAddress = resources.find((res, _) => res['@type'] === 'PackageBaseAddress/3.0.0');
    const id = packageBaseAddress['@id'];
    console.log(`packageBaseAddress is: ${id}`);

    const lowerCaseLanguageServerPackageName = 'Microsoft.CodeAnalysis.LanguageServer'.toLocaleLowerCase();
    const nuspecGetUrl = `${id}${lowerCaseLanguageServerPackageName}/${roslynVersion}/${lowerCaseLanguageServerPackageName}.nuspec`;
    console.log(`Url to get nuspec file is ${nuspecGetUrl}`);
    const nuspecResponse = await sendHttpsGetRequestAsync(nuspecGetUrl);
    if (!nuspecResponse) {
        return null;
    }

    const nuspecFile = await xml2js.parseStringPromise(nuspecResponse.data);
    const commitNumber = nuspecFile.package.metadata[0].repository[0].$['commit'];
    console.log(`commitNumber is ${commitNumber}`);
    return commitNumber;
}

async function tagRepoAsync(commit: string, personalPat?: string): Promise<void> {
    const pat = personalPat ?? process.env['GitHubPat'];
    if (!pat) {
        throw 'No GitHub Pat found.';
    }

    const octokit = new Octokit({ auth: pat });
    const requestToGetExistingTags = await octokit.request(`GET /roslyn/cosifne/git/tag/${commit}`, {
        onwer: 'Cosifne',
        repo: 'roslyn',
        tag_sha: commit,
    });

    if (requestToGetExistingTags.status !== 200) {
        logError('Failed to get exist tags from commit');
        return;
    }

    console.log(requestToGetExistingTags.data);
}

async function sendHttpsGetRequestAsync(url: string): Promise<AxiosResponse<any, any> | null> {
    try {
        const nuspecResponse = await axios.get(url);
        if (nuspecResponse.status != 200) {
            logError('Failed to get nuspec file from nuget server');
            return null;
        }
        return nuspecResponse;
    } catch (err) {
        logError(`Failed to get response for ${url}`);
    }

    return null;
}

function logError(message: string): void {
    console.log(`##vso[task.logissue type=error]${message}`);
}
