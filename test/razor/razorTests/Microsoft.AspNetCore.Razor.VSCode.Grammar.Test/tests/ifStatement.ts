﻿/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, it } from '@jest/globals';
import { assertMatchesSnapshot } from './infrastructure/testUtilities';

// See GrammarTests.test.ts for details on exporting this test suite instead of running in place.

export function RunIfStatementSuite() {
    describe('@if ( ... ) { ... }', () => {
        it('Incomplete if statement, no condition or body', async () => {
            await assertMatchesSnapshot('@if');
        });

        it('Incomplete if statement, no condition', async () => {
            await assertMatchesSnapshot('@if {}');
        });

        it('Single line', async () => {
            await assertMatchesSnapshot('@if (true) { var x = 123;<p>Hello World</p> }');
        });

        it('Multi line condition', async () => {
            await assertMatchesSnapshot(
                `@if (
    await GetTrueValue(
        () => true,
        name: "The Good Identifier",
        new {
            Foo = false,
        }
)){}`
            );
        });

        it('Multi line body', async () => {
            await assertMatchesSnapshot(
                `@if (1 + 1 == 2)
{
    var x = 123;
    <div>
        @if ( AnotherCondition() ) {
            <p></p>
        }
    </div>
}else if (true){}`
            );
        });

        it('Nested inside if', async () => {
            await assertMatchesSnapshot(
                `@if (true)
{
    if (true) {
        <p></p>
    }
}`
            );
        });

        it('Not in HTML', async () => {
            await assertMatchesSnapshot(
                `<div>
    if (this is classified) we have a problem
</div>`
            );
        });
    });
}
