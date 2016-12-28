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
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("C"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("int"),
                Tokens.Identifiers.FieldName("x"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Numeric.Decimal("0"),
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("hexadecimal zero", () => {

            const input = `
class C {
    int x = 0x0;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("C"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("int"),
                Tokens.Identifiers.FieldName("x"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Numeric.Hexadecimal("0x0"),
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("binary zero", () => {

            const input = `
class C {
    int x = 0b0;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("C"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("int"),
                Tokens.Identifiers.FieldName("x"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Numeric.Binary("0b0"),
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("floating-point zero", () => {

            const input = `
class C {
    float x = 0.0;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("C"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("float"),
                Tokens.Identifiers.FieldName("x"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Numeric.Decimal("0.0"),
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });
    });
});