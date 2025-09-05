/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as process from 'node:process';
import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';
import { spawnSync } from 'child_process';
import { getPackageJSON } from './packageJson';
import { Octokit } from '@octokit/rest';

type Options = {
    userName?: string;
    email?: string;
};

async function git(args: string[], printCommand = true): Promise<string> {
    if (printCommand) {
        console.log(`git ${args.join(' ')}`);
    }

    const git = spawnSync('git', args);
    if (git.status != 0) {
        const err = git.stderr ? git.stderr.toString() : '';
        if (printCommand) {
            console.error(`Failed to execute git ${args.join(' ')}.`);
        }
        throw new Error(err || `git ${args.join(' ')} failed with code ${git.status}`);
    }

    const stdout = git.stdout ? git.stdout.toString() : '';
    if (printCommand) {
        console.log(stdout);
    }
    return Promise.resolve(stdout);
}

gulp.task('publish roslyn copilot', async () => {
    const parsedArgs = minimist<Options>(process.argv.slice(2));

    // Get staging directory from environment variable passed from pipeline
    const stagingDir = process.env['STAGING_DIRECTORY'];
    if (!stagingDir) {
        console.log('STAGING_DIRECTORY environment variable not set; skipping package.json update.');
        return;
    }

    if (!fs.existsSync(stagingDir)) {
        console.log(`Staging directory not found at ${stagingDir}; skipping package.json update.`);
        return;
    }

    // Find the Roslyn zip file in the staging directory (we know it was copied here)
    const files = fs.readdirSync(stagingDir);
    const zipFile = files.find((file) => /Roslyn\.LanguageServer.*\.zip$/i.test(file));

    if (!zipFile) {
        console.log(`No Roslyn LanguageServer zip file found in ${stagingDir}; skipping package.json update.`);
        return;
    }

    const zipPath = path.join(stagingDir, zipFile);
    console.log(`Using zip file: ${zipPath}`);
    const zipName = zipFile;

    // Extract version from file name
    // Example: "Microsoft.VisualStudio.Copilot.Roslyn.LanguageServer-18.0.671-alpha.zip"
    let version: string | null = null;
    const m = zipName.match(/Microsoft\.VisualStudio\.Copilot\.Roslyn\.LanguageServer-(.+)\.zip$/i);
    if (m && m[1]) {
        version = m[1];
    }

    if (!version) {
        console.log(`Could not extract version from file name ${zipName}; skipping.`);
        return;
    }

    console.log(`Extracted version: ${version}`);

    const pkg = getPackageJSON();
    let updated = false;

    if (pkg.runtimeDependencies && Array.isArray(pkg.runtimeDependencies)) {
        for (let i = 0; i < pkg.runtimeDependencies.length; i++) {
            const dep = pkg.runtimeDependencies[i];
            if (dep && dep.id === 'RoslynCopilot') {
                const oldUrl = dep.url as string;
                const newUrl = oldUrl.replace(
                    /Microsoft\.VisualStudio\.Copilot\.Roslyn\.LanguageServer-[^/]+?\.zip/,
                    `Microsoft.VisualStudio.Copilot.Roslyn.LanguageServer-${version}.zip`
                );
                if (oldUrl !== newUrl) {
                    pkg.runtimeDependencies[i].url = newUrl;
                    updated = true;
                    console.log(`Updated RoslynCopilot url:\n  ${oldUrl}\n-> ${newUrl}`);
                } else {
                    console.log('RoslynCopilot url already up to date.');
                }
                break;
            }
        }
    }

    if (!updated) {
        console.log('No changes required to package.json; aborting PR creation.');
        return;
    }

    // Persist package.json
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n', { encoding: 'utf8' });

    // Prepare git
    const safeVersion = version.replace(/[^A-Za-z0-9_.-]/g, '-');
    const branch = `update/roslyn-copilot-${safeVersion}`;

    // Make this optional so it can be tested locally by using dev's information. In real CI user name and email are always supplied.
    if (parsedArgs.userName) {
        await git(['config', '--local', 'user.name', parsedArgs.userName]);
    }
    if (parsedArgs.email) {
        await git(['config', '--local', 'user.email', parsedArgs.email]);
    }

    await git(['checkout', '-b', branch]);
    await git(['add', 'package.json']);
    await git(['commit', '-m', `chore: update RoslynCopilot url to ${version}`]);

    const pat = process.env['GitHubPAT'];
    if (!pat) {
        throw 'No GitHub PAT found.';
    }

    const remoteRepoAlias = 'targetRepo';
    await git(
        ['remote', 'add', remoteRepoAlias, `https://${parsedArgs.userName}:${pat}@github.com/dotnet/vscode-csharp.git`],
        // Note: don't print PAT to console
        false
    );
    await git(['fetch', remoteRepoAlias]);

    const lsRemote = await git(['ls-remote', remoteRepoAlias, 'refs/head/' + branch]);
    if (lsRemote.trim() !== '') {
        // If the localization branch of this commit already exists, don't try to create another one.
        console.log(`##vso[task.logissue type=error]${branch} already exists in dotnet/vscode-csharp. Skip pushing.`);
    } else {
        await git(['push', '-u', remoteRepoAlias]);
    }

    // Create PR via Octokit
    try {
        const octokit = new Octokit({ auth: pat });
        const listPullRequest = await octokit.rest.pulls.list({
            owner: 'dotnet',
            repo: 'vscode-csharp',
        });

        if (listPullRequest.status != 200) {
            throw `Failed get response from GitHub, http status code: ${listPullRequest.status}`;
        }

        const title = `Update RoslynCopilot url to ${version}`;
        if (listPullRequest.data.some((pr) => pr.title === title)) {
            console.log('Pull request with the same name already exists. Skip creation.');
            return;
        }

        const body = `Automated update of RoslynCopilot url to ${version}`;

        console.log(`Creating PR against dotnet/vscode-csharp...`);
        const pullRequest = await octokit.rest.pulls.create({
            owner: 'dotnet',
            repo: 'vscode-csharp',
            title: title,
            head: branch,
            base: 'main',
            body: body,
        });
        console.log(`Created pull request: ${pullRequest.data.html_url}`);
    } catch (e) {
        console.warn('Failed to create PR via Octokit:', e);
    }
});
