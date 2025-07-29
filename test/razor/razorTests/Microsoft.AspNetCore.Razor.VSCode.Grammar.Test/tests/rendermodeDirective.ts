/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, it } from '@jest/globals';
import { assertMatchesSnapshot } from './infrastructure/testUtilities';

// See GrammarTests.test.ts for details on exporting this test suite instead of running in place.

export function RunRendermodeDirectiveSuite() {
    describe('@rendermode directive', () => {
        it('No mode', async () => {
            await assertMatchesSnapshot('@rendermode');
        });

        it('No mode spaced', async () => {
            await assertMatchesSnapshot('@rendermode              ');
        });

        it('Incomplete mode', async () => {
            await assertMatchesSnapshot('@rendermode InteractiveWebAssemb');
        });

        it('Mode provided', async () => {
            await assertMatchesSnapshot('@rendermode InteractiveServer');
        });

        it('Mode provided spaced', async () => {
            await assertMatchesSnapshot('@rendermode              InteractiveAuto         ');
        });
    });
}
