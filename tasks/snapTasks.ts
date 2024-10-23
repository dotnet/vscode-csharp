/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

gulp.task('incrementVersion', async (): Promise<void> => {
    // Get the current version from version.json
    const versionFilePath = path.join(path.resolve(__dirname, '..'), 'version.json');
    const file = fs.readFileSync(versionFilePath, 'utf8');
    const versionJson = JSON.parse(file);

    // Increment the minor version
    const version = versionJson.version as string;
    const split = version.split('.');
    const newVersion = `${split[0]}.${parseInt(split[1]) + 1}`;

    console.log(`Updating ${version} to ${newVersion}`);

    // Write the new version back to version.json
    versionJson.version = newVersion;
    const newJson = JSON.stringify(versionJson, null, 4);
    console.log(`New json: ${newJson}`);

    fs.writeFileSync(versionFilePath, newJson);

    // Add a new changelog section for the new version.
    console.log('Adding new version header to changelog');

    const changelogPath = path.join(path.resolve(__dirname, '..'), 'CHANGELOG.md');
    const changelogContent = fs.readFileSync(changelogPath, 'utf8');
    const changelogLines = changelogContent.split(os.EOL);

    // Find all the headers in the changelog (and their line numbers)
    const headerRegex = /^#+\s+.*$/gm;
    const matches = [];
    for (let i = 0; i < changelogLines.length; i++) {
        const line = changelogLines.at(i);
        const match = headerRegex.exec(line!);
        if (match) {
            matches.push({ line: i, text: match[0] });
        }
    }

    // Find the known issues header, then find the next header after it.
    const knownIssuesHeader = matches.find((m) => m.text.includes('Known Issues'));
    if (knownIssuesHeader === undefined) {
        throw new Error('Could not find the known issues header in the changelog.');
    }
    const knownIssuesIndex = matches.indexOf(knownIssuesHeader);
    if (knownIssuesIndex === -1) {
        throw new Error('Could not find the known issues index in the matches.');
    }

    // Insert a new header for the new version after the known issues header but before the next header.
    const lineToInsertAt = matches[knownIssuesIndex + 1].line - 1;
    console.log(`Inserting new version header at line ${lineToInsertAt}`);
    const linesToInsert = ['', `# ${newVersion}.x`];

    changelogLines.splice(lineToInsertAt, 0, ...linesToInsert);
    fs.writeFileSync(changelogPath, changelogLines.join(os.EOL));
});
