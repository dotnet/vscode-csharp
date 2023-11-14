/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'fs';
import { describe, test, expect } from '@jest/globals';

describe('package.nls.json validation tests', () => {
    const langCodes = ['cs', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt-br', 'ru', 'tr', 'zh-cn', 'zh-tw'];
    const keysWithURLExamples = [
        'generateOptionsSchema.symbolOptions.searchPaths.description',
        'generateOptionsSchema.symbolOptions.searchMicrosoftSymbolServer.description',
        'generateOptionsSchema.symbolOptions.searchNuGetOrgSymbolServer.description',
    ];

    langCodes.forEach((lang) => {
        test(`Verify \\u200b exists in example URLs in package.nls.${lang}.json`, () => {
            const filename = `package.nls.${lang}.json`;
            const packageNLSJson = JSON.parse(readFileSync(filename).toString());
            for (const key of keysWithURLExamples) {
                try {
                    expect(packageNLSJson[key]).toContain('\u200b');
                } catch (e) {
                    throw "Missing \\u200b in example urls, please run 'gulp fixLocURLs' and check in those changes.";
                }
            }
        });
    });
});
