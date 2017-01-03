/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Constructors", () => {
        it("instance constructor with no parameters", () => {

            const input = Input.InClass(`TestClass() { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("TestClass"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace]);
        });

        it("instance constructor with two parameters", () => {

            const input = Input.InClass(`
TestClass(int x, int y)
{
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("TestClass"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace]);
        });

        it("instance constructor with expression body", () => {

            const input = Input.InClass(`TestClass(int x, int y) => Foo();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("TestClass"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Operators.Arrow,
                Token.Variables.ReadWrite("Foo"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon]);
        });

        it("static constructor no parameters", () => {

            const input = Input.InClass(`TestClass() { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("TestClass"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace]);
        });
    });
});