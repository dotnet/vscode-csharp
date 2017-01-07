/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Literals - numeric", () => {
        it("decimal zero", () => {

            const input = Input.InClass(`int x = 0;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("int"),
                Token.Identifiers.FieldName("x"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("0"),
                Token.Punctuation.Semicolon]);
        });

        it("hexadecimal zero", () => {

            const input = Input.InClass(`int x = 0x0;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("int"),
                Token.Identifiers.FieldName("x"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Hexadecimal("0x0"),
                Token.Punctuation.Semicolon]);
        });

        it("binary zero", () => {

            const input = Input.InClass(`int x = 0b0;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("int"),
                Token.Identifiers.FieldName("x"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Binary("0b0"),
                Token.Punctuation.Semicolon]);
        });

        it("floating-point zero", () => {

            const input = Input.InClass(`float x = 0.0;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("float"),
                Token.Identifiers.FieldName("x"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("0.0"),
                Token.Punctuation.Semicolon]);
        });
    });
});