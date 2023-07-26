/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, assert } from 'chai';
import { readFileSync } from 'fs';

suite('package.json validation tests', () => {
    suiteSetup(() => should());

    test('Verify \\u200b exists in example URLs', () => {
        const packageJson = JSON.parse(readFileSync('package.json').toString());
        const configurationAttributes = packageJson['contributes']['debuggers'][0]['configurationAttributes'];
        const errorMessage =
            "Missing '\\u200b' in example URLs, please run 'gulp generateOptionsSchema' to regenerate these strings.";

        const debugConfigurations = ['launch', 'attach'];
        for (const config of debugConfigurations) {
            const symbolOptionsProperties =
                configurationAttributes[config]['properties']['symbolOptions']['properties'];
            assert.include(symbolOptionsProperties.searchPaths.description, '\u200b', errorMessage);
            assert.include(symbolOptionsProperties.searchMicrosoftSymbolServer.description, '\u200b', errorMessage);
            assert.include(symbolOptionsProperties.searchNuGetOrgSymbolServer.description, '\u200b', errorMessage);
        }
    });
});
