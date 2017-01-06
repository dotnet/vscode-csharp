/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Checked/Unchecked", () => {
        it("checked statement", () => {
            const input = Input.InMethod(`
checked
{
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Checked,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace
            ]);
        });

        it("unchecked statement", () => {
            const input = Input.InMethod(`
unchecked
{
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Unchecked,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace
            ]);
        });

        it("checked expression", () => {
            const input = Input.InMethod(`int x = checked(42);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("int"),
                Token.Variables.Local("x"),
                Token.Operators.Assignment,
                Token.Keywords.Checked,
                Token.Puncuation.OpenParen,
                Token.Literals.Numeric.Decimal("42"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("unchecked expression", () => {
            const input = Input.InMethod(`int x = unchecked(42);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("int"),
                Token.Variables.Local("x"),
                Token.Operators.Assignment,
                Token.Keywords.Unchecked,
                Token.Puncuation.OpenParen,
                Token.Literals.Numeric.Decimal("42"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });
    });
});