/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, it } from '@jest/globals';
import { assertMatchesSnapshot } from './infrastructure/testUtilities';

// See GrammarTests.test.ts for details on exporting this test suite instead of running in place.

export function RunTypeparamDirectiveSuite() {
    describe('@typeparam directive', () => {
        it('No type', async () => {
            await assertMatchesSnapshot('@typeparam');
        });

        it('No type spaced', async () => {
            await assertMatchesSnapshot('@typeparam              ');
        });

        it('Incomplete type, generic', async () => {
            await assertMatchesSnapshot('@typeparam SomeViewBase<string');
        });

        it('Type provided', async () => {
            await assertMatchesSnapshot('@typeparam Person');
        });

        it('Type provided spaced', async () => {
            await assertMatchesSnapshot('@typeparam              Person         ');
        });
    });
}
