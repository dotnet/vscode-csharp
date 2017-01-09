/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Checked/Unchecked", () => {
        it("checked expression", () => {
            const input = Input.InMethod(`int x = checked(42);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.Int,
                Token.Variables.Local("x"),
                Token.Operators.Assignment,
                Token.Keywords.Checked,
                Token.Punctuation.OpenParen,
                Token.Literals.Numeric.Decimal("42"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("unchecked expression", () => {
            const input = Input.InMethod(`int x = unchecked(42);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.Int,
                Token.Variables.Local("x"),
                Token.Operators.Assignment,
                Token.Keywords.Unchecked,
                Token.Punctuation.OpenParen,
                Token.Literals.Numeric.Decimal("42"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("checked expression inside checked statement", () => {
            const input = `
class C
{
    void M1()
    {
        checked
        {
            checked(++i);
        }
    }
    void M2() { }
}
`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Class,
                Token.Identifiers.ClassName("C"),
                Token.Punctuation.OpenBrace,
                Token.PrimitiveType.Void,
                Token.Identifiers.MethodName("M1"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,

                Token.Keywords.Checked,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Checked,
                Token.Punctuation.OpenParen,
                Token.Operators.Increment,
                Token.Variables.ReadWrite("i"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace,

                Token.Punctuation.CloseBrace,
                Token.PrimitiveType.Void,
                Token.Identifiers.MethodName("M2"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseBrace
            ]);
        });
    });
});