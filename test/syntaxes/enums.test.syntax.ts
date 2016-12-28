/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Enums", () => {
        it("simple enum", () => {

            const input = `enum E { }`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Enum,
                Token.Identifiers.EnumName("E"),
                Token.Puncuation.CurlyBrace.Open,
                Token.Puncuation.CurlyBrace.Close]);
        });

        it("enum with base type", () => {

            const input = `enum E : byte { }`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Enum,
                Token.Identifiers.EnumName("E"),
                Token.Puncuation.Colon,
                Token.Type("byte"),
                Token.Puncuation.CurlyBrace.Open,
                Token.Puncuation.CurlyBrace.Close]);
        });

        it("enum with single member", () => {

            const input = `enum E { M1 }`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Enum,
                Token.Identifiers.EnumName("E"),
                Token.Puncuation.CurlyBrace.Open,
                Token.Variables.EnumMember("M1"),
                Token.Puncuation.CurlyBrace.Close]);
        });

        it("enum with multiple members", () => {

            const input = `enum Color { Red, Green, Blue }`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Enum,
                Token.Identifiers.EnumName("Color"),
                Token.Puncuation.CurlyBrace.Open,
                Token.Variables.EnumMember("Red"),
                Token.Puncuation.Comma,
                Token.Variables.EnumMember("Green"),
                Token.Puncuation.Comma,
                Token.Variables.EnumMember("Blue"),
                Token.Puncuation.CurlyBrace.Close]);
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

            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Enum,
                Token.Identifiers.EnumName("E"),
                Token.Puncuation.CurlyBrace.Open,
                Token.Variables.EnumMember("Value1"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("1"),
                Token.Puncuation.Comma,
                Token.Variables.EnumMember("Value2"),
                Token.Puncuation.Comma,
                Token.Variables.EnumMember("Value3"),
                Token.Puncuation.CurlyBrace.Close]);
        });
    });
});