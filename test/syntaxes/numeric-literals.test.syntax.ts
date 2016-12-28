/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Literals - numeric", () => {
        it("decimal zero", () => {

            const input = `
class C {
    int x = 0;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("C", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(2, 9),

                Tokens.Type("int", 3, 5),
                Tokens.Identifiers.FieldName("x", 3, 9),
                Tokens.Operators.Assignment(3, 11),
                Tokens.Literals.Numeric.Decimal("0", 3, 13),
                Tokens.Puncuation.Semicolon(3, 14),

                Tokens.Puncuation.CurlyBrace.Close(4, 1)]);
        });

        it("hexadecimal zero", () => {

            const input = `
class C {
    int x = 0x0;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("C", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(2, 9),

                Tokens.Type("int", 3, 5),
                Tokens.Identifiers.FieldName("x", 3, 9),
                Tokens.Operators.Assignment(3, 11),
                Tokens.Literals.Numeric.Hexadecimal("0x0", 3, 13),
                Tokens.Puncuation.Semicolon(3, 16),

                Tokens.Puncuation.CurlyBrace.Close(4, 1)]);
        });

        it("binary zero", () => {

            const input = `
class C {
    int x = 0b0;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("C", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(2, 9),

                Tokens.Type("int", 3, 5),
                Tokens.Identifiers.FieldName("x", 3, 9),
                Tokens.Operators.Assignment(3, 11),
                Tokens.Literals.Numeric.Binary("0b0", 3, 13),
                Tokens.Puncuation.Semicolon(3, 16),

                Tokens.Puncuation.CurlyBrace.Close(4, 1)]);
        });

        it("floating-point zero", () => {

            const input = `
class C {
    float x = 0.0;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("C", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(2, 9),

                Tokens.Type("float", 3, 5),
                Tokens.Identifiers.FieldName("x", 3, 11),
                Tokens.Operators.Assignment(3, 13),
                Tokens.Literals.Numeric.Decimal("0.0", 3, 15),
                Tokens.Puncuation.Semicolon(3, 18),

                Tokens.Puncuation.CurlyBrace.Close(4, 1)]);
        });
    });
});