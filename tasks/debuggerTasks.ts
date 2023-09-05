/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as fs from 'fs';
import * as os from 'os';

import * as optionsSchemaGenerator from '../src/tools/generateOptionsSchema';
import * as packageDependencyUpdater from '../src/tools/updatePackageDependencies';

// Disable warning about wanting an async function
// tslint:disable-next-line
gulp.task('generateOptionsSchema', async (): Promise<void> => {
    optionsSchemaGenerator.GenerateOptionsSchema();
    return Promise.resolve();
});

// Disable warning about wanting an async function
// tslint:disable-next-line
gulp.task('updatePackageDependencies', async (): Promise<void> => {
    return packageDependencyUpdater.updatePackageDependencies();
});

// Disable warning about wanting an async function
// tslint:disable-next-line
gulp.task('fixLocURLs', async (): Promise<void> => {
    const langCodes = ['cs', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt-br', 'ru', 'tr', 'zh-cn', 'zh-tw'];
    const keysWithURLExamples = [
        'generateOptionsSchema.symbolOptions.searchPaths.description',
        'generateOptionsSchema.symbolOptions.searchMicrosoftSymbolServer.description',
        'generateOptionsSchema.symbolOptions.searchNuGetOrgSymbolServer.description',
    ];

    langCodes.forEach((lang) => {
        const filename = `package.nls.${lang}.json`;
        const packageNLSJson = JSON.parse(fs.readFileSync(filename).toString());

        for (const key of keysWithURLExamples) {
            if (!packageNLSJson[key].toString().includes('\u200b')) {
                // Look for instances of http[s] with our without the hidden zero-width symbol and add it.
                packageNLSJson[key] = packageNLSJson[key].replace(/http(s?)\u200b?:\/\//, `http$1:\u200b://`);
                // Find the instances of /download/symbols and inject a hidden zero-width symbol.
                packageNLSJson[key] = packageNLSJson[key].replace(
                    /\u200b?\/download\/symbols/,
                    `\u200b/download/symbols`
                );
            }
        }

        let content = JSON.stringify(packageNLSJson, null, 2);
        if (os.platform() === 'win32') {
            content = content.replace(/\n/gm, '\r\n');
        }
        content = content.replace(/\u200b/gm, '\\u200b');

        fs.writeFileSync(filename, content);
    });
});
