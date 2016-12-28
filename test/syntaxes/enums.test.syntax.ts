/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { Tokens } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe("Enums", () => {
        it("simple enum", () => {

            const input = `
enum E { }
`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Enum(2, 1),
                Tokens.Identifiers.EnumName("E", 2, 6),
                Tokens.Puncuation.CurlyBrace.Open(2, 8),
                Tokens.Puncuation.CurlyBrace.Close(2, 10)]);
        });

        it("enum with base type", () => {

            const input = `
enum E : byte { }
`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Enum(2, 1),
                Tokens.Identifiers.EnumName("E", 2, 6),
                Tokens.Puncuation.Colon(2, 8),
                Tokens.Type("byte", 2, 10),
                Tokens.Puncuation.CurlyBrace.Open(2, 15),
                Tokens.Puncuation.CurlyBrace.Close(2, 17)]);
        });

        it("enum with single member", () => {

            const input = `
enum E { M1 }
`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Enum(2, 1),
                Tokens.Identifiers.EnumName("E", 2, 6),
                Tokens.Puncuation.CurlyBrace.Open(2, 8),
                Tokens.Variables.EnumMember("M1", 2, 10),
                Tokens.Puncuation.CurlyBrace.Close(2, 13)]);
        });

        it("enum with multiple members", () => {

            const input = `
enum Color { Red, Green, Blue }
`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Enum(2, 1),
                Tokens.Identifiers.EnumName("Color", 2, 6),
                Tokens.Puncuation.CurlyBrace.Open(2, 12),
                Tokens.Variables.EnumMember("Red", 2, 14),
                Tokens.Puncuation.Comma(2, 17),
                Tokens.Variables.EnumMember("Green", 2, 19),
                Tokens.Puncuation.Comma(2, 24),
                Tokens.Variables.EnumMember("Blue", 2, 26),
                Tokens.Puncuation.CurlyBrace.Close(2, 31)]);
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

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Enum(2, 1),
                Tokens.Identifiers.EnumName("E", 2, 6),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),
                Tokens.Variables.EnumMember("Value1", 4, 5),
                Tokens.Operators.Assignment(4, 12),
                Tokens.Literals.Numeric.Decimal("1", 4, 14),
                Tokens.Puncuation.Comma(4, 15),
                Tokens.Variables.EnumMember("Value2", 5, 5),
                Tokens.Puncuation.Comma(5, 11),
                Tokens.Variables.EnumMember("Value3", 6, 5),
                Tokens.Puncuation.CurlyBrace.Close(7, 1)]);
        });
    });
});


