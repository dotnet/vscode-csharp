/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Iteration statements (loops)", () => {
        it("single-line while loop", () => {
            const input = Input.InMethod(`while (true) { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Control.While,
                Token.Punctuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("single-line do..while loop", () => {

            const input = Input.InMethod(`do { } while (true);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Control.Do,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Control.While,
                Token.Punctuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("single-line for loop", () => {

            const input = Input.InMethod(`for (int i = 0; i < 42; i++) { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Control.For,
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.Int,
                Token.Variables.Local("i"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("0"),
                Token.Punctuation.Semicolon,
                Token.Variables.ReadWrite("i"),
                Token.Operators.Relational.LessThan,
                Token.Literals.Numeric.Decimal("42"),
                Token.Punctuation.Semicolon,
                Token.Variables.ReadWrite("i"),
                Token.Operators.Increment,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
            ]);
        });

        it("for loop with break", () => {

            const input = Input.InMethod(`
for (int i = 0; i < 42; i++)
{
    break;
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Control.For,
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.Int,
                Token.Variables.Local("i"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("0"),
                Token.Punctuation.Semicolon,
                Token.Variables.ReadWrite("i"),
                Token.Operators.Relational.LessThan,
                Token.Literals.Numeric.Decimal("42"),
                Token.Punctuation.Semicolon,
                Token.Variables.ReadWrite("i"),
                Token.Operators.Increment,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Control.Break,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace,
            ]);
        });

        it("for loop with continue", () => {

            const input = Input.InMethod(`
for (int i = 0; i < 42; i++)
{
    continue;
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Control.For,
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.Int,
                Token.Variables.Local("i"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("0"),
                Token.Punctuation.Semicolon,
                Token.Variables.ReadWrite("i"),
                Token.Operators.Relational.LessThan,
                Token.Literals.Numeric.Decimal("42"),
                Token.Punctuation.Semicolon,
                Token.Variables.ReadWrite("i"),
                Token.Operators.Increment,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Control.Continue,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace,
            ]);
        });

        it("single-line foreach loop", () => {

            const input = Input.InMethod(`foreach (int i in numbers) { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Control.ForEach,
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.Int,
                Token.Variables.Local("i"),
                Token.Keywords.Control.In,
                Token.Variables.ReadWrite("numbers"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
            ]);
        });

        it("foreach loop with var (issue #816)", () => {

            const input = Input.InMethod(`
foreach (var s in myList)
{

}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Control.ForEach,
                Token.Punctuation.OpenParen,
                Token.Keywords.Var,
                Token.Variables.Local("s"),
                Token.Keywords.Control.In,
                Token.Variables.ReadWrite("myList"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
            ]);
        });
    });
});