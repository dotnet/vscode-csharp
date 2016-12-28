/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Methods", () => {
        it("single-line declaration with no parameters", () => {

            const input = Input.InClass(`void Foo() { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("void"),
                Token.Identifiers.MethodName("Foo"),
                Token.Puncuation.Parenthesis.Open,
                Token.Puncuation.Parenthesis.Close,
                Token.Puncuation.CurlyBrace.Open,
                Token.Puncuation.CurlyBrace.Close]);
        });

        it("declaration with two parameters", () => {

            const input = Input.InClass(`
int Add(int x, int y)
{
    return x + y;
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("int"),
                Token.Identifiers.MethodName("Add"),
                Token.Puncuation.Parenthesis.Open,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.Parenthesis.Close,
                Token.Puncuation.CurlyBrace.Open,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Arithmetic.Addition,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CurlyBrace.Close]);
        });

        it("expression body", () => {

            const input = Input.InClass(`int Add(int x, int y) => x + y;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("int"),
                Token.Identifiers.MethodName("Add"),
                Token.Puncuation.Parenthesis.Open,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.Parenthesis.Close,
                Token.Operators.Arrow,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Arithmetic.Addition,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon]);
        });
    });
});