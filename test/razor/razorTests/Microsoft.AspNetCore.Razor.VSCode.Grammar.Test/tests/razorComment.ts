/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, it } from '@jest/globals';
import { assertMatchesSnapshot } from './infrastructure/testUtilities';

// See GrammarTests.test.ts for details on exporting this test suite instead of running in place.

export function RunRazorCommentSuite() {
    describe('Razor comment', () => {
        it('Single line', async () => {
            await assertMatchesSnapshot('@* Hello *@');
        });

        it('Multiple line', async () => {
            await assertMatchesSnapshot(
                `@* Hello, this is a
multiline Razor comment. *@`
            );
        });

        it('Empty', async () => {
            await assertMatchesSnapshot(`@**@`);
        });

        it('Nested', async () => {
            await assertMatchesSnapshot(`@* Hello @* World *@ *@`);
        });
    });
}
