/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Destructor", () => {
        it("declaration", () => {

            const input = Input.InClass(`~TestClass() { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Tilde,
                Token.Identifiers.MethodName("TestClass"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("with expression body", () => {

            const input = Input.InClass(`~TestClass() => Foo();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Tilde,
                Token.Identifiers.MethodName("TestClass"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Identifiers.MethodName("Foo"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon]);
        });
    });
});