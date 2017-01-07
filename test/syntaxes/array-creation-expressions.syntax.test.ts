/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Array creation expressions", () => {
        it("passed as argument", () => {

            const input = Input.InMethod(`c.abst(ref s, new int[] {1, i, i});`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Variables.Object("c"),
                Token.Punctuation.Accessor,
                Token.Identifiers.MethodName("abst"),
                Token.Punctuation.OpenParen,
                Token.Keywords.Modifiers.Ref,
                Token.Variables.ReadWrite("s"),
                Token.Punctuation.Comma,
                Token.Keywords.New,
                Token.Type("int"),
                Token.Punctuation.OpenBracket,
                Token.Punctuation.CloseBracket,
                Token.Punctuation.OpenBrace,
                Token.Literals.Numeric.Decimal("1"),
                Token.Punctuation.Comma,
                Token.Variables.ReadWrite("i"),
                Token.Variables.ReadWrite("i"),
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });
    });
});