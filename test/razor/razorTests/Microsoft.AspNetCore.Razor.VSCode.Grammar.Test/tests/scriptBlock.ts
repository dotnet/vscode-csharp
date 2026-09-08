/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, it } from '@jest/globals';
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

        it('script block with type and data attributes', async () => {
            await assertMatchesSnapshot(
                `<script type="text/javascript" data-origin="carousel-home-slider">
    $(function () {
        // a comment
    });
</script>`
            );
        });

        it('script block with type and data attributes inside if statement', async () => {
            await assertMatchesSnapshot(
                `@if (true) {
    <script type="text/javascript" data-origin="carousel-home-slider">
        $(function () {
            // a comment
        });
    </script>
}`
            );
        });

        it('script block with Razor attribute inside if statement', async () => {
            await assertMatchesSnapshot(
                `@if (true) {
    <script nonce="@nonce">
        const carousel = true;
    </script>
}`
            );
        });

        it('similarly named custom element inside if statement', async () => {
            await assertMatchesSnapshot(
                `@if (true) {
    <script-widget>@Model.Content</script-widget>
}`
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
