/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, it } from '@jest/globals';
import { assertMatchesSnapshot } from './infrastructure/testUtilities';

// See GrammarTests.test.ts for details on exporting this test suite instead of running in place.

export function RunPreservewhitespaceDirectiveSuite() {
    describe('@preservewhitespace directive', () => {
        it('No bool', async () => {
            await assertMatchesSnapshot('@preservewhitespace');
        });

        it('No bool spaced', async () => {
            await assertMatchesSnapshot('@preservewhitespace              ');
        });

        it('Incomplete bool', async () => {
            await assertMatchesSnapshot('@preservewhitespace fal');
        });

        it('Bool provided (true)', async () => {
            await assertMatchesSnapshot('@preservewhitespace true');
        });

        it('Bool provided (false)', async () => {
            await assertMatchesSnapshot('@preservewhitespace false');
        });

        it('Bool provided spaced', async () => {
            await assertMatchesSnapshot('@preservewhitespace              false         ');
        });
    });
}
