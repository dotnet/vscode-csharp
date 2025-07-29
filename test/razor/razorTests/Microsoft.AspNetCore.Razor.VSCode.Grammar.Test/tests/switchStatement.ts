﻿/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, it } from '@jest/globals';
import { assertMatchesSnapshot } from './infrastructure/testUtilities';

// See GrammarTests.test.ts for details on exporting this test suite instead of running in place.

export function RunSwitchStatementSuite() {
    describe('@switch ( ... ) { ... }', () => {
        it('Incomplete switch statement, no condition or body', async () => {
            await assertMatchesSnapshot('@switch');
        });

        it('Incomplete switch statement, no condition', async () => {
            await assertMatchesSnapshot('@switch {}');
        });

        it('Incomplete switch statement, no cases', async () => {
            await assertMatchesSnapshot('@switch (condition) {Console.WriteLine("Invalid?")}');
        });

        it('Single line', async () => {
            await assertMatchesSnapshot('@switch (   value  ) { case 123: var x = 123;<p>Hello World</p>break; }');
        });

        it('Multi line condition', async () => {
            await assertMatchesSnapshot(
                `@switch (
    await GetAValue(
        () => true,
        name: "Hello",
        new {
            Foo = false,
        }
)){}`
            );
        });

        it('Multi line body', async () => {
            await assertMatchesSnapshot(
                `@switch (SomeProperty)
{
    case 123:
        var x = 123;
        <div>
            @switch (GetAnotherValue()) {
                case: 456
                    <p></p>
                break;
            }
        </div>
        break;
}`
            );
        });

        it('Nested inside if', async () => {
            await assertMatchesSnapshot(
                `@if (true)
{
    switch (SomeProp) {
        case 123:
            <p></p>
            break;
    }
}`
            );
        });

        it('Not in HTML', async () => {
            await assertMatchesSnapshot(
                `<div>
    switch (over to better classifications)
</div>`
            );
        });

        it('comment in HTML text node', async () => {
            await assertMatchesSnapshot(
                `@switch (true)
{
    case true:
    {
        <p>this is a text https://example.org<h3>Test</h3></p>
    }
        break;
}`
            );
        });
    });
}
