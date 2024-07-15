/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as fs from 'fs';
import * as path from 'path';

gulp.task('incrementVersionJson', async (): Promise<void> => {
    const versionFilePath = path.join(path.resolve(__dirname, '..'), 'version.json');
    const file = fs.readFileSync(versionFilePath, 'utf8');
    const versionJson = JSON.parse(file);

    const version = versionJson.version as string;
    const split = version.split('.');
    const newVersion = `${split[0]}.${parseInt(split[1]) + 1}`;

    console.log(`Updating ${version} to ${newVersion}`);

    versionJson.version = newVersion;
    const newJson = JSON.stringify(versionJson, null, 4);
    console.log(`New json: ${newJson}`);

    fs.writeFileSync(versionFilePath, newJson);
});
