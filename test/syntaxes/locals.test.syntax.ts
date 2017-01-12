/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Locals", () => {
        it("declaration", () => {
            const input = Input.InMethod(`int x;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.Int,
                Token.Identifiers.LocalName("x"),
                Token.Punctuation.Semicolon
            ]);
        });

        it("declaration with initializer", () => {
            const input = Input.InMethod(`int x = 42;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.Int,
                Token.Identifiers.LocalName("x"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("42"),
                Token.Punctuation.Semicolon
            ]);
        });

        it("multiple declarators", () => {
            const input = Input.InMethod(`int x, y;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.Int,
                Token.Identifiers.LocalName("x"),
                Token.Punctuation.Comma,
                Token.Identifiers.LocalName("y"),
                Token.Punctuation.Semicolon
            ]);
        });

        it("multiple declarators with initializers", () => {
            const input = Input.InMethod(`int x = 19, y = 23;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.Int,
                Token.Identifiers.LocalName("x"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("19"),
                Token.Punctuation.Comma,
                Token.Identifiers.LocalName("y"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("23"),
                Token.Punctuation.Semicolon
            ]);
        });

        it("const declaration", () => {
            const input = Input.InMethod(`const int x = 42;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Const,
                Token.PrimitiveType.Int,
                Token.Identifiers.LocalName("x"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("42"),
                Token.Punctuation.Semicolon
            ]);
        });

        it("const with multiple declarators", () => {
            const input = Input.InMethod(`const int x = 19, y = 23;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Const,
                Token.PrimitiveType.Int,
                Token.Identifiers.LocalName("x"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("19"),
                Token.Punctuation.Comma,
                Token.Identifiers.LocalName("y"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("23"),
                Token.Punctuation.Semicolon
            ]);
        });
    });
});