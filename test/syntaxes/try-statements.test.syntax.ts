/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Try statements", () => {
        it("try-finally", () => {
            const input = Input.InMethod(`
try
{
}
finally
{
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Try,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Finally,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("try-catch", () => {
            const input = Input.InMethod(`
try
{
}
catch
{
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Try,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Catch,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("try-catch-finally", () => {
            const input = Input.InMethod(`
try
{
}
catch
{
}
finally
{
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Try,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Catch,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Finally,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("try-catch with exception type", () => {
            const input = Input.InMethod(`
try
{
}
catch (Exception)
{
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Try,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Catch,
                Token.Punctuation.OpenParen,
                Token.Type("Exception"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("try-catch with exception type and identifier", () => {
            const input = Input.InMethod(`
try
{
}
catch (Exception ex)
{
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Try,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Catch,
                Token.Punctuation.OpenParen,
                Token.Type("Exception"),
                Token.Variables.Local("ex"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("try-catch with exception filter", () => {
            const input = Input.InMethod(`
try
{
    throw new Exception();
}
catch when (true)
{
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Try,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Throw,
                Token.Keywords.New,
                Token.Type("Exception"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Catch,
                Token.Keywords.When,
                Token.Punctuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("try-catch with exception type and filter", () => {
            const input = Input.InMethod(`
try
{
}
catch (Exception) when (true)
{
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Try,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Catch,
                Token.Punctuation.OpenParen,
                Token.Type("Exception"),
                Token.Punctuation.CloseParen,
                Token.Keywords.When,
                Token.Punctuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("try-finally followed by statement", () => {
            const input = Input.InMethod(`
try
{
}
finally
{
}
int x;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Try,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Finally,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.PrimitiveType.Int,
                Token.Variables.Local("x"),
                Token.Punctuation.Semicolon
            ]);
        });
    });
});