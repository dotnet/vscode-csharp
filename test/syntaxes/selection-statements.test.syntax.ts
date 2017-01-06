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
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.CloseParen,
                Token.Variables.ReadWrite("Do"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("single-line if with block", () => {
            const input = Input.InMethod(`if (true) { Do(); }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.If,
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Variables.ReadWrite("Do"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace
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
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.CloseParen,
                Token.Variables.ReadWrite("Do"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
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
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Variables.ReadWrite("Do"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace
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
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.CloseParen,
                Token.Variables.ReadWrite("Do"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon,
                Token.Keywords.Else,
                Token.Variables.ReadWrite("Dont"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
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
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Variables.ReadWrite("Do"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace,
                Token.Keywords.Else,
                Token.Puncuation.OpenBrace,
                Token.Variables.ReadWrite("Dont"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace
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
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.CloseParen,
                Token.Variables.ReadWrite("Do"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon,
                Token.Keywords.Else,
                Token.Keywords.If,
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.False,
                Token.Puncuation.CloseParen,
                Token.Variables.ReadWrite("Dont"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
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
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Variables.ReadWrite("Do"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace,
                Token.Keywords.Else,
                Token.Keywords.If,
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.False,
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Variables.ReadWrite("Dont"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace
            ]);
        });
    });
});