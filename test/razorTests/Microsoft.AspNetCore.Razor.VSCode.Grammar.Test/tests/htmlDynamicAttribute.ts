/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, it } from '@jest/globals';
import { assertMatchesSnapshot } from './infrastructure/testUtilities';

// See GrammarTests.test.ts for details on exporting this test suite instead of running in place.

export function RunHTMLDynamicAttributeSuite() {
    describe('HTML dynamic (razor) attribute', () => {
        it('razor inside attribute', async () => {
            await assertMatchesSnapshot('<div id="@("")"> </div>');
        });

        it('single quotes in side double quotes', async () => {
            await assertMatchesSnapshot('<button @onclick="myFunction(\'test\')">Test</button>');
        });

        it('double quotes inside single quotes', async () => {
            await assertMatchesSnapshot('<button @onclick=\'myFunction("test")\'>Test</button>');
        });

        it('using data string array', async () => {
            await assertMatchesSnapshot('<p data-string-array="[\'test\', \'@Localizer["test"]\']">Test</p>');
        });

        it('using @viewData', async () => {
            await assertMatchesSnapshot('<a asp-page="@ViewData["Page"]">Test</a>');
        });
    });
}
