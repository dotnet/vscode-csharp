﻿/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, it } from '@jest/globals';
import { assertMatchesSnapshot } from './infrastructure/testUtilities';

// See GrammarTests.test.ts for details on exporting this test suite instead of running in place.

export function RunUsingStatementSuite() {
    describe('@using ( ... ) { ... }', () => {
        it('Incomplete using statement, no condition or body', async () => {
            await assertMatchesSnapshot('@using');
        });

        it('Incomplete using statement, no condition', async () => {
            await assertMatchesSnapshot('@using {}');
        });

        it('Single line', async () => {
            await assertMatchesSnapshot('@using (someDisposable) { var x = 123;<p>Hello World</p> }');
        });

        it('Multi line condition', async () => {
            await assertMatchesSnapshot(
                `@using (
    await GetSomeDisposableAsync(
        () => true,
        name: "The Good Disposable",
        new {
            Foo = false,
        }
)){}`
            );
        });

        it('Multi line body', async () => {
            await assertMatchesSnapshot(
                `@using (SomeDisposable)
{
    var x = 123;
    <div>
        @using (GetAnotherDisposable()) {
            <p></p>
        }
    </div>
}`
            );
        });

        it('Nested inside if', async () => {
            await assertMatchesSnapshot(
                `@if (true)
{
    using (SomeDisposable) {
        <p></p>
    }
}`
            );
        });

        it('Not in HTML', async () => {
            await assertMatchesSnapshot(
                `<div>
    using (the best potatoes)
</div>`
            );
        });
    });
}
