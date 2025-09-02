/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as xml2js from 'xml2js';
import { allNugetPackages} from './offlinePackagingTasks';
import {getCommitFromNugetAsync, logWarning, logError, createBranchAndPR } from './gitHelpers';
import * as os from 'os';

const execAsync = promisify(exec);

interface InsertionOptions {
    roslynVersion?: string;
    roslynEndSHA?: string;
    roslynBuildId?: string;
    roslynBuildNumber?: string;
    assetManifestPath?: string;
    roslynRepoPath?: string;
    targetBranch?: string;
    githubPAT?: string;
    dryRun?: boolean;
}

gulp.task('insertion:roslyn', async (): Promise<void> => {
    const options = minimist<InsertionOptions>(process.argv.slice(2));
    
    console.log('Starting Roslyn insertion process...');
    
    try {
        // Step 1: Extract Roslyn version from AssetManifest
        if (!options.assetManifestPath) {
            throw new Error('assetManifestPath is required');
        }
        
        const newVersion = await extractRoslynVersionFromManifest(options.assetManifestPath);
        if (!newVersion) {
            throw new Error('Failed to extract Roslyn version from asset manifest');
        }
        options.roslynVersion = newVersion;
        console.log(`New Roslyn version: ${newVersion}`);
        
        // Step 2: Get current SHA from package
        const currentSHA = await getCommitFromNugetAsync(allNugetPackages.roslyn);
        if (!currentSHA) {
            throw new Error('Could not determine current Roslyn SHA from package');
        }
        console.log(`Current Roslyn SHA: ${currentSHA}`);
        
        // Step 3: Check if update needed
        if (!options.roslynEndSHA) {
            throw new Error('roslynEndSHA is required');
        }
        
        if (currentSHA === options.roslynEndSHA) {
            console.log('No new commits to process - versions are identical');
            return;
        }
        
        console.log(`Update needed: ${currentSHA}..${options.roslynEndSHA}`);
        
        // Step 4: Verify Roslyn repo exists
        if (!options.roslynRepoPath) {
            throw new Error('roslynRepoPath is required');
        }
        await verifyRoslynRepo(options.roslynRepoPath);
        
        // Step 5: Generate PR list
        const prList = await generatePRList(currentSHA, options.roslynEndSHA, options.roslynRepoPath, options);
        console.log('PR List generated:', prList);
        
        // Check if PR list is empty or contains no meaningful PRs
        if (!prList || prList === '(no PRs with required labels)') {
            console.log('No PRs with required labels found. Skipping insertion.');
            logWarning('No PRs with VSCode label found between the commits. Skipping insertion.');
            return;
        }
        
        // Step 6: Update files
        await updatePackageJson(options.roslynVersion);
        await updateChangelog(options.roslynVersion, prList, options.roslynBuildNumber, options.roslynBuildId);
        
        // Step 7: Create branch and PR
        const prTitle = `Bump Roslyn to ${options.roslynVersion} (${options.roslynEndSHA?.substring(0, 8)})`;
        const prBody = `This PR updates Roslyn to version ${options.roslynVersion} (${options.roslynEndSHA}).\n\n${prList}`;
        
        await createBranchAndPR({
            ...options,
            commitSha: options.roslynEndSHA!,
            targetRemoteRepo: 'vscode-csharp',
            baseBranch: options.targetBranch || 'main',
            branchPrefix: 'insertion',
            githubPAT: options.githubPAT!,
            dryRun: options.dryRun
        }, prTitle, prBody);
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError(`Insertion failed: ${errorMessage}`);
        if (error instanceof Error && error.stack) {
            console.log(`##[debug]${error.stack}`);
        }
        throw error;
    }
});

async function extractRoslynVersionFromManifest(manifestPath: string): Promise<string | null> {
    const xmlFile = path.join(manifestPath, 'OfficialBuild.xml');
    
    if (!fs.existsSync(xmlFile)) {
        logError(`OfficialBuild.xml not found at ${xmlFile}`);
        return null;
    }
    
    const xmlContent = fs.readFileSync(xmlFile, 'utf8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlContent);
    
    const packages = result?.Build?.Package || [];
    for (const pkg of packages) {
        const attrs = pkg.$;
        if (attrs?.Id === 'Microsoft.CodeAnalysis.Common') {
            return attrs.Version;
        }
    }
    
    return null;
}

async function verifyRoslynRepo(roslynRepoPath: string): Promise<void> {
    if (!fs.existsSync(roslynRepoPath)) {
        throw new Error(`Roslyn repository not found at ${roslynRepoPath}`);
    }
    console.log(`Using Roslyn repository at ${roslynRepoPath}`);
}

async function generatePRList(startSHA: string, endSHA: string, roslynRepoPath: string, options: InsertionOptions): Promise<string> {
    console.log(`Generating PR list from ${startSHA} to ${endSHA}...`);
    
    // Setup auth for roslyn-tools
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const settingsDir = path.join(homeDir!, '.roslyn-tools');
    if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
    }
    
    const authJson = {
        GitHubToken: options.githubPAT || '',
        DevDivAzureDevOpsToken: '',
        DncEngAzureDevOpsToken: ''
    };
    const settingsFile = path.join(settingsDir, 'settings');
    fs.writeFileSync(settingsFile, Buffer.from(JSON.stringify(authJson)).toString('base64'));
    
    try {
        const { stdout } = await execAsync(
            `cd "${roslynRepoPath}" && roslyn-tools pr-finder -s "${startSHA}" -e "${endSHA}" --format changelog --label VSCode`,
            { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
        );
        return stdout || '(no PRs with required labels)';
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logWarning(`PR finder failed, using empty list: ${errorMessage}`);
        if (error instanceof Error && error.stack) {
            console.log(`##[debug]${error.stack}`);
        }
        return '(no PRs with required labels)';
    }
}

async function updatePackageJson(newVersion: string): Promise<void> {
    console.log(`Updating package.json with Roslyn version ${newVersion}...`);
    const packageJsonPath = 'package.json';
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    if (!packageJson.defaults) {
        throw new Error('Could not find defaults section in package.json');
    }
    packageJson.defaults.roslyn = newVersion;
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}

async function updateChangelog(version: string, prList: string, buildNumber?: string, buildId?: string): Promise<void> {
	console.log('Updating CHANGELOG.md...');
	const changelogPath = 'CHANGELOG.md';
	const orig = fs.readFileSync(changelogPath, 'utf8');

	// Preserve original line endings
	const originalHasCRLF = orig.indexOf('\r\n') !== -1;
	const NL = os.EOL; 

	// Normalize for processing
	const text = orig.replace(/\r\n/g, NL);

	// Prepare PR list (filter out 'View Complete Diff' lines)
	// Normalize each PR line (trim) so we don't accidentally double-indent when inserting.
	const prLines = prList
		? prList
				.split(/\r?\n/)
				.filter((l) => l.trim() && !l.includes('View Complete Diff'))
				.map((line) => line.trim())
		: [];

	const formattedPRList = prLines.length > 0 ? prLines.map((line) => `  ${line}`).join(NL) : '';

	// Find the first top-level header "# ..."
	const topHeaderRegex = /^# .*/m;
	const headerMatch = topHeaderRegex.exec(text);
	if (!headerMatch) {
		// No top-level header; prepend a Roslyn bump
		const prLink = buildNumber && buildId
			? `[#${buildNumber}](https://dev.azure.com/dnceng/internal/_build/results?buildId=${buildId})`
			: '[#TBD](TBD)';
		let roslynBlock = `* Bump Roslyn to ${version} (PR: ${prLink})`;
		if (formattedPRList && prList && prList !== '(no PRs with required labels)') {
			roslynBlock += NL + formattedPRList;
		}
		roslynBlock += NL;
		const out = originalHasCRLF ? (roslynBlock + text).replace(/\n/g, '\r\n') : roslynBlock + text;
		fs.writeFileSync(changelogPath, out, 'utf8');
		console.log('CHANGELOG.md updated successfully');
		return;
	}

	const headerStart = headerMatch.index;
	const headerLineEnd = text.indexOf(NL, headerStart);
	const headerLineEndIndex = headerLineEnd === -1 ? text.length : headerLineEnd;

	// Find end of this header section (next top-level header or EOF)
	const nextTopHeaderRegex = /^# .*/gm;
	nextTopHeaderRegex.lastIndex = headerLineEndIndex + 1;
	const nextHeaderMatch = nextTopHeaderRegex.exec(text);
	const sectionEndIndex = nextHeaderMatch ? nextHeaderMatch.index : text.length;

	const body = text.substring(headerLineEndIndex + 1, sectionEndIndex);

	// Split body into leading content + top-level bullet blocks (each starts with "* ")
	const bulletStartRegex = /^\* /gm;
	const starts: number[] = [];
	let m: RegExpExecArray | null;
	while ((m = bulletStartRegex.exec(body)) !== null) {
		starts.push(m.index);
	}

	let leading = '';
	let blocks: string[] = [];
	if (starts.length === 0) {
		leading = body;
		blocks = [];
	} else {
		leading = body.slice(0, starts[0]);
		for (let i = 0; i < starts.length; i++) {
			const s = starts[i];
			const e = i + 1 < starts.length ? starts[i + 1] : body.length;
			blocks.push(body.slice(s, e));
		}
	}

	// Locate Roslyn and Razor blocks
	let roslynIndex = -1;
	let razorIndex = -1;
	for (let i = 0; i < blocks.length; i++) {
		const firstLine = blocks[i].split(NL, 1)[0].trim();
		if (/^\*\s*Bump\s+Roslyn\s+to/i.test(firstLine)) {
			roslynIndex = i;
		} else if (/^\*\s*Bump\s+Razor\s+to/i.test(firstLine)) {
			razorIndex = i;
		}
	}

	// Prepare new Roslyn block + optional PR list
	const prLink = buildNumber && buildId
		? `[#${buildNumber}](https://dev.azure.com/dnceng/internal/_build/results?buildId=${buildId})`
		: '[#TBD](TBD)';
	let newRoslynBlock = `* Bump Roslyn to ${version} (PR: ${prLink})`;
	if (formattedPRList && prList && prList !== '(no PRs with required labels)') {
		newRoslynBlock += NL + formattedPRList;
	}
	if (!newRoslynBlock.endsWith(NL)) {
		newRoslynBlock += NL;
	}

	// Rebuild blocks according to the rules
	const newBlocks: string[] = [];
	let roslynInserted = false;

	for (let i = 0; i < blocks.length; i++) {
		if (i === roslynIndex) {
			// Update version and PR link in place (preserving any existing bullet contents)
			let updated = blocks[i].replace(
				/^(\* Bump Roslyn to\s+)([^\s(]+)(?:\s*\(PR:[^)]+\))?/i,
				`$1${version} (PR: ${prLink})`
			);

			// If we have a PR list and the existing block does not already contain it, insert it before existing PR bullets.
			if (prLines.length > 0 && prList && prList !== '(no PRs with required labels)') {
				const firstPR = prLines[0];

				// If the first PR is not already present in the block, insert our formatted PR list.
				if (!updated.includes(firstPR)) {
					// Try to locate the first existing PR bullet (lines like "\n  * ...")
					const prBulletIndex = updated.indexOf(NL + '  * ');
					if (prBulletIndex !== -1) {
						// Insert formatted PR list before the first existing PR bullet.
						const insertPos = prBulletIndex + NL.length; // position just before the bullet line
						const prefix = updated.slice(0, insertPos);
						const suffix = updated.slice(insertPos);
						updated = prefix + formattedPRList + NL + suffix;
					} else {
						// If no existing bullets found, append as before.
						if (!updated.endsWith(NL)) updated += NL;
						updated += formattedPRList + NL;
					}
				}
			}

			newBlocks.push(updated);
			roslynInserted = true;
		} else if (i === razorIndex) {
			// Insert Roslyn before Razor if not already inserted
			if (!roslynInserted) {
				newBlocks.push(newRoslynBlock);
				roslynInserted = true;
			}
			newBlocks.push(blocks[i]);
		} else {
			newBlocks.push(blocks[i]);
		}
	}

	// If Roslyn not inserted yet, place it at the top of the first section (after leading)
	if (!roslynInserted) {
		if (newBlocks.length > 0) {
			newBlocks.unshift(newRoslynBlock);
		} else {
			// No bullet blocks found; append into leading
			leading = leading + newRoslynBlock;
		}
	}

	// Assemble new body and full text
	const rebuiltBlocks = newBlocks.join(NL);
	const newBody = leading + rebuiltBlocks;
	const newTextNormalized = text.slice(0, headerLineEndIndex + 1) + newBody + text.slice(sectionEndIndex);

	// Restore original newline style (normalize any newline to the original style)
	const finalText = newTextNormalized.replace(/\r\n|\r|\n/g, originalHasCRLF ? '\r\n' : '\n');
	fs.writeFileSync(changelogPath, finalText, 'utf8');

	console.log('CHANGELOG.md updated successfully');
}
