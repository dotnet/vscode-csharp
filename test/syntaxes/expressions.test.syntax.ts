/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Expressions", () => {
        it("array creation expression passed as argument", () => {
            const input = Input.InMethod(`c.abst(ref s, new int[] {1, i, i});`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Variables.Object("c"),
                Token.Punctuation.Accessor,
                Token.Identifiers.MethodName("abst"),
                Token.Punctuation.OpenParen,
                Token.Keywords.Modifiers.Ref,
                Token.Variables.ReadWrite("s"),
                Token.Punctuation.Comma,
                Token.Keywords.New,
                Token.PrimitiveType.Int,
                Token.Punctuation.OpenBracket,
                Token.Punctuation.CloseBracket,
                Token.Punctuation.OpenBrace,
                Token.Literals.Numeric.Decimal("1"),
                Token.Punctuation.Comma,
                Token.Variables.ReadWrite("i"),
                Token.Punctuation.Comma,
                Token.Variables.ReadWrite("i"),
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("arithmetic", () => {
            const input = Input.InMethod(`b = this.i != 1 + (2 - 3);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Variables.ReadWrite("b"),
                Token.Operators.Assignment,
                Token.Keywords.This,
                Token.Punctuation.Accessor,
                Token.Variables.Property("i"),
                Token.Operators.Relational.NotEqual,
                Token.Literals.Numeric.Decimal("1"),
                Token.Operators.Arithmetic.Addition,
                Token.Punctuation.OpenParen,
                Token.Literals.Numeric.Decimal("2"),
                Token.Operators.Arithmetic.Subtraction,
                Token.Literals.Numeric.Decimal("3"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("typeof", () => {
            const input = Input.InMethod(`var t = typeof(List<>);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Var,
                Token.Variables.Local("t"),
                Token.Operators.Assignment,
                Token.Keywords.TypeOf,
                Token.Punctuation.OpenParen,
                Token.Type("List"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("default", () => {
            const input = Input.InMethod(`var t = default(List<>);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Var,
                Token.Variables.Local("t"),
                Token.Operators.Assignment,
                Token.Keywords.Default,
                Token.Punctuation.OpenParen,
                Token.Type("List"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });
    });
});