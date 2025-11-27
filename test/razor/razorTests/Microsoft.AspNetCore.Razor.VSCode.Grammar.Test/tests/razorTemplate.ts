/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, it } from '@jest/globals';
import { assertMatchesSnapshot } from './infrastructure/testUtilities';

// See GrammarTests.test.ts for details on exporting this test suite instead of running in place.

export function RunRazorTemplateSuite() {
    describe('Razor templates @<p>....</p>', () => {
        it('Malformed', async () => {
            await assertMatchesSnapshot('@ <p></p>');
        });

        it('Malformed attributes', async () => {
            await assertMatchesSnapshot('@<p class="></p>');
        });

        it('Incomplete', async () => {
            await assertMatchesSnapshot('@<strong>');
        });

        it('Empty', async () => {
            await assertMatchesSnapshot('@<p></p>');
        });

        it('Void', async () => {
            await assertMatchesSnapshot('@<hr>');
        });

        it('Self-closing', async () => {
            await assertMatchesSnapshot('@<hr class="stuff" />');
        });

        it('Single line local variable', async () => {
            await assertMatchesSnapshot('@{ Action<object> abc = @<div>Hello World</p>; }');
        });

        it('Nested template', async () => {
            await assertMatchesSnapshot(
                '@{ Action<object> abc = @<div>@{ Action<object> def = @<p class="john" onclick=\'someMethod\'>Hello World</p>; }</div>; }'
            );
        });

        it('Complex HTML tag structure non-template', async () => {
            await assertMatchesSnapshot('@{@<p><input      /><strong>Hello <hr/> <br> World</strong></p>}');
        });

        it('Nested template in @code directive', async () => {
            await assertMatchesSnapshot(
                `@code {
    public Action<int> GetTemplate()
    {
        Action<int> template = @<p>@item</p>;
        return template;
    }
}`
            );
        });

        it('Nested template in @functions directive', async () => {
            await assertMatchesSnapshot(
                `@functions {
    public Action<int> GetTemplate()
    {
        Action<int> template = @<p>@item</p>;
        return template;
    }
}`
            );
        });

        it('Nested template in implicit expression', async () => {
            await assertMatchesSnapshot(
                `@CallSomeMethod(@<p style="margin:1px;">
    The Template
</p>)`
            );
        });

        it('Nested template in explicit expression', async () => {
            await assertMatchesSnapshot(
                `@(CallSomeMethod(@<p>
    The Template
</p>))`
            );
        });

        it('Nested for statement with templates', async () => {
            await assertMatchesSnapshot(
                `@{
    for (var i = 0; i % 2 == 0; i++)
    {
        Action<int> template = @<p>@item</p>;
        @template(i)
    }
}`
            );
        });

        it('Nested foreach statement with template', async () => {
            await assertMatchesSnapshot(
                `@{
    foreach (var person in people)
    {
        Action<int> template = @<p>@item</p>;
        @template(i)
    }
}`
            );
        });

        it('Nested do while statement with template', async () => {
            await assertMatchesSnapshot(
                `@{
    var i = 0;
    do
    {
        Action<int> template = @<p>@item</p>;
        @template(i)
    } while (i++ != 10);
}`
            );
        });

        it('Nested while statement with template', async () => {
            await assertMatchesSnapshot(
                `@{
    var i = 0;
    while (i++ != 10)
    {
        Action<int> template = @<p>@item</p>;
        @template(i)
    }
}`
            );
        });

        it('Nested lock statement with template', async () => {
            await assertMatchesSnapshot(
                `@{
    lock (someObject)
    {
        Action<string> template = @<p class="world">@item</p>;
        @template(someObject.ToString())
    }
}`
            );
        });

        it('Nested using statement with template', async () => {
            await assertMatchesSnapshot(
                `@{
    using (someDisposable)
    {
        Action<int> template = @<p>@item</p>;
    }
}`
            );
        });

        it('Nested try statement with template', async () => {
            await assertMatchesSnapshot(
                `@{
    try
    {
        Action<int> template = @<p>@item</p>;
    } catch (Exception ex){}
}`
            );
        });

        it('Nested switch statement with template', async () => {
            await assertMatchesSnapshot(
                `@{
    switch (something)
    {
        case true:
            Action<int> template = @<p>@item</p>;
            break;
    }
}`
            );
        });

        it('Complex with various nested statements', async () => {
            await assertMatchesSnapshot(
                `@{
    if (true) {
        <div>
        @using (someDisposable) {
            <p>Foo!</p>
            var x = 123;
            while (i++ % 2 == 0)
            {
                Action<int> template = @<p>
                    @item

                    @{
                        Action anotherTemplate = @<strong class='really loud!'>LOUD</strong>;
                    }
                    </p>;
            }
        }
        </div>
    }
}`
            );
        });

        it('Simple template with attribute', async () => {
            await assertMatchesSnapshot(
                `@{
    RenderFragment x = @<div class="test">Hello</div>;
}`
            );
        });

        it('Template with multiple attributes', async () => {
            await assertMatchesSnapshot(
                `@{
    RenderFragment x = @<div id="container" class="wrapper" style="color: red;">Content</div>;
}`
            );
        });

        it('Template compared to normal HTML', async () => {
            await assertMatchesSnapshot(
                `<h1 class="title" data-length="@Name.Length">@Name</h1>

@code
{
    public string Name { get; set; } = "Home Page";

    public RenderFragment ChildContent => @<span class="highlight" data-length="@Name.Length">@Name</span>;
}`
            );
        });

        it('Void tag template with attributes', async () => {
            await assertMatchesSnapshot('@{ RenderFragment x = @<input type="text" placeholder="Enter name" />; }');
        });

        it('Void tag hr with class attribute', async () => {
            await assertMatchesSnapshot('@{ RenderFragment divider = @<hr class="separator" />; }');
        });

        it('Void tag br in template', async () => {
            await assertMatchesSnapshot('@{ RenderFragment lineBreak = @<br class="spacer" />; }');
        });

        it('Void tag img with multiple attributes', async () => {
            await assertMatchesSnapshot('@{ RenderFragment image = @<img src="photo.jpg" alt="Photo" class="thumbnail" />; }');
        });

        it('Void tag meta in template', async () => {
            await assertMatchesSnapshot('@{ RenderFragment meta = @<meta name="viewport" content="width=device-width" />; }');
        });

        it('Template with data attributes', async () => {
            await assertMatchesSnapshot(
                `@{
    RenderFragment x = @<div data-id="123" data-name="test">Data content</div>;
}`
            );
        });

        it('Template with event handler attributes', async () => {
            await assertMatchesSnapshot(
                `@{
    RenderFragment x = @<button onclick="handleClick()" onmouseover="highlight()">Click me</button>;
}`
            );
        });

        it('Template with directive attributes', async () => {
            await assertMatchesSnapshot(
                `@{
    RenderFragment x = @<button @onclick="HandleClick" @onmouseover="HandleMouseOver">Click me</button>;
}`
            );
        });
    });
}
