/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Enums", () => {
        it("simple enum", () => {

            const input = `
enum E { }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Enum,
                Tokens.Identifiers.EnumName("E"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("enum with base type", () => {

            const input = `
enum E : byte { }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Enum,
                Tokens.Identifiers.EnumName("E"),
                Tokens.Puncuation.Colon,
                Tokens.Type("byte"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("enum with single member", () => {

            const input = `
enum E { M1 }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Enum,
                Tokens.Identifiers.EnumName("E"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Variables.EnumMember("M1"),
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("enum with multiple members", () => {

            const input = `
enum Color { Red, Green, Blue }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Enum,
                Tokens.Identifiers.EnumName("Color"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Variables.EnumMember("Red"),
                Tokens.Puncuation.Comma,
                Tokens.Variables.EnumMember("Green"),
                Tokens.Puncuation.Comma,
                Tokens.Variables.EnumMember("Blue"),
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("enum with initialized member", () => {

            const input = `
enum E
{
    Value1 = 1,
    Value2,
    Value3
}
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Enum,
                Tokens.Identifiers.EnumName("E"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Variables.EnumMember("Value1"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Numeric.Decimal("1"),
                Tokens.Puncuation.Comma,
                Tokens.Variables.EnumMember("Value2"),
                Tokens.Puncuation.Comma,
                Tokens.Variables.EnumMember("Value3"),
                Tokens.Puncuation.CurlyBrace.Close]);
        });
    });
});