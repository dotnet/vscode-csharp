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
                Token.Keywords.While,
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace
            ]);
        });

        it("single-line do..while loop", () => {

            const input = Input.InMethod(`do { } while (true);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Do,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,
                Token.Keywords.While,
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("single-line for loop", () => {

            const input = Input.InMethod(`for (int i = 0; i < 42; i++) { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.For,
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Local("i"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("0"),
                Token.Puncuation.Semicolon,
                Token.Variables.ReadWrite("i"),
                Token.Operators.Relational.LessThan,
                Token.Literals.Numeric.Decimal("42"),
                Token.Puncuation.Semicolon,
                Token.Variables.ReadWrite("i"),
                Token.Operators.Increment,
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,
            ]);
        });

        it("single-line foreach loop", () => {

            const input = Input.InMethod(`foreach (int i in numbers) { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.ForEach,
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Local("i"),
                Token.Keywords.In,
                Token.Variables.ReadWrite("numbers"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,
            ]);
        });
    });
});