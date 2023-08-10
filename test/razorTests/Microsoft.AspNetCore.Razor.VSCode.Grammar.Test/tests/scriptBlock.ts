/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { assertMatchesSnapshot } from './infrastructure/testUtilities';

// See GrammarTests.test.ts for details on exporting this test suite instead of running in place.

export function RunScriptBlockSuite() {
    describe('script block function', () => {
        it('function declaration', async () => {
            await assertMatchesSnapshot(
                `<script>
    function f()
    {
    }
</script>`
            );
        });

        it('script block var plain', async () => {
            await assertMatchesSnapshot(
                `<script>
    var x = "test";
</script>`
            );
        });

        it('script block import', async () => {
            await assertMatchesSnapshot(
                `<script>
    import fs from 'fs';
</script>`
            );
        });
    });
}
