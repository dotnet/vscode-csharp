﻿/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, it } from '@jest/globals';
import { assertMatchesSnapshot } from './infrastructure/testUtilities';

// See GrammarTests.test.ts for details on exporting this test suite instead of running in place.

export function RunForStatementSuite() {
    describe('@for ( ... ) { ... }', () => {
        it('Incomplete for statement, no condition or body', async () => {
            await assertMatchesSnapshot('@for');
        });

        it('Incomplete for statement, no condition', async () => {
            await assertMatchesSnapshot('@for {}');
        });

        it('Single line', async () => {
            await assertMatchesSnapshot('@for (var i = 0; i < GetCount(); i++)) { var x = 123;<p>Hello World @i</p> }');
        });

        it('Multi line condition', async () => {
            await assertMatchesSnapshot(
                `@for (
    var j = GetInitialValue(name: true);
    j <= await GetMaxIncrementCount(
        () => true,
        name: "The Good Value",
        new {
            Foo = false,
        });
    j++
){}`
            );
        });

        it('Multi line body', async () => {
            await assertMatchesSnapshot(
                `@for (var i = 0; i < 10; i++)
{
    var x = 123;
    <div>
        @for (i = i + 1; i < 10; i+= 2) {
            <p>@i</p>
        }
    </div>
}`
            );
        });

        it('Nested inside if', async () => {
            await assertMatchesSnapshot(
                `@if (true)
{
    for (var i = 0; i < 10; i++) {
        <p></p>
    }
}`
            );
        });

        it('Not in HTML', async () => {
            await assertMatchesSnapshot(
                `<div>
    for (this) is the best classification
</div>`
            );
        });
    });
}
