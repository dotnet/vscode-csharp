/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Literals - numeric", () => {
        it("decimal zero", () => {

            const input = Input.InClass(`int x = 0;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Type("int"),
                Tokens.Identifiers.FieldName("x"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Numeric.Decimal("0"),
                Tokens.Puncuation.Semicolon]);
        });

        it("hexadecimal zero", () => {

            const input = Input.InClass(`int x = 0x0;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Type("int"),
                Tokens.Identifiers.FieldName("x"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Numeric.Hexadecimal("0x0"),
                Tokens.Puncuation.Semicolon]);
        });

        it("binary zero", () => {

            const input = Input.InClass(`int x = 0b0;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Type("int"),
                Tokens.Identifiers.FieldName("x"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Numeric.Binary("0b0"),
                Tokens.Puncuation.Semicolon]);
        });

        it("floating-point zero", () => {

            const input = Input.InClass(`float x = 0.0;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Type("float"),
                Tokens.Identifiers.FieldName("x"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Numeric.Decimal("0.0"),
                Tokens.Puncuation.Semicolon]);
        });
    });
});