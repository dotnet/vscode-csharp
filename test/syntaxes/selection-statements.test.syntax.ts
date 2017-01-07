/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Selection statements", () => {
        it("single-line if with embedded statement", () => {
            const input = Input.InMethod(`if (true) Do();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.If,
                Token.Punctuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Identifiers.MethodName("Do"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("single-line if with block", () => {
            const input = Input.InMethod(`if (true) { Do(); }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.If,
                Token.Punctuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Identifiers.MethodName("Do"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("if with embedded statement", () => {
            const input = Input.InMethod(`
if (true)
    Do();
`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.If,
                Token.Punctuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Identifiers.MethodName("Do"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("if with block", () => {
            const input = Input.InMethod(`
if (true)
{
    Do();
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.If,
                Token.Punctuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Identifiers.MethodName("Do"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("if-else with embedded statements", () => {
            const input = Input.InMethod(`
if (true)
    Do();
else
    Dont();
`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.If,
                Token.Punctuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Identifiers.MethodName("Do"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Keywords.Else,
                Token.Identifiers.MethodName("Dont"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("if-else with blocks", () => {
            const input = Input.InMethod(`
if (true)
{
    Do();
}
else
{
    Dont();
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.If,
                Token.Punctuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Identifiers.MethodName("Do"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Else,
                Token.Punctuation.OpenBrace,
                Token.Identifiers.MethodName("Dont"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("if-elseif with embedded statements", () => {
            const input = Input.InMethod(`
if (true)
    Do();
else if (false)
    Dont();
`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.If,
                Token.Punctuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Identifiers.MethodName("Do"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Keywords.Else,
                Token.Keywords.If,
                Token.Punctuation.OpenParen,
                Token.Literals.Boolean.False,
                Token.Punctuation.CloseParen,
                Token.Identifiers.MethodName("Dont"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("if-elseif with blocks", () => {
            const input = Input.InMethod(`
if (true)
{
    Do();
}
else if (false)
{
    Dont();
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.If,
                Token.Punctuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Identifiers.MethodName("Do"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Else,
                Token.Keywords.If,
                Token.Punctuation.OpenParen,
                Token.Literals.Boolean.False,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Identifiers.MethodName("Dont"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("switch statement", () => {
            const input = Input.InMethod(`
switch (i) {
case 0:
    goto case 1;
case 1:
    goto default;
default:
    break;
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Switch,
                Token.Punctuation.OpenParen,
                Token.Variables.ReadWrite("i"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Case,
                Token.Literals.Numeric.Decimal("0"),
                Token.Punctuation.Colon,
                Token.Keywords.Goto,
                Token.Keywords.Case,
                Token.Literals.Numeric.Decimal("1"),
                Token.Punctuation.Semicolon,
                Token.Keywords.Case,
                Token.Literals.Numeric.Decimal("1"),
                Token.Punctuation.Colon,
                Token.Keywords.Goto,
                Token.Keywords.Default,
                Token.Punctuation.Semicolon,
                Token.Keywords.Default,
                Token.Punctuation.Colon,
                Token.Keywords.Break,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("switch statement with blocks", () => {
            const input = Input.InMethod(`
switch (i) {
    case 0:
    {
        goto case 1;
    }
    case 1:
    {
        goto default;
    }
    default:
    {
        break;
    }
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Switch,
                Token.Punctuation.OpenParen,
                Token.Variables.ReadWrite("i"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Case,
                Token.Literals.Numeric.Decimal("0"),
                Token.Punctuation.Colon,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Goto,
                Token.Keywords.Case,
                Token.Literals.Numeric.Decimal("1"),
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Case,
                Token.Literals.Numeric.Decimal("1"),
                Token.Punctuation.Colon,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Goto,
                Token.Keywords.Default,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Default,
                Token.Punctuation.Colon,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Break,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseBrace
            ]);
        });
    });
});