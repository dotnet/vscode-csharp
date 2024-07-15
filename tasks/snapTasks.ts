/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as fs from 'fs';
import * as path from 'path';

gulp.task('incrementVersionJson', async (): Promise<void> => {
    let versionFilePath = path.join(path.resolve(__dirname, '..'), 'version.json');
    let file = fs.readFileSync(versionFilePath, 'utf8');
    let versionJson = JSON.parse(file);

    let version = versionJson.version as string;
    let split = version.split('.');
    let newVersion = `${split[0]}.${parseInt(split[1]) + 1}`;

    console.log(`Updating ${version} to ${newVersion}`);

    versionJson.version = newVersion;
    let newJson = JSON.stringify(versionJson, null, 4);
    console.log(`New json: ${newJson}`);

    fs.writeFileSync(versionFilePath, newJson);
});