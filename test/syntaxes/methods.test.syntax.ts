/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Methods", () => {
        it("single-line declaration with no parameters", () => {

            const input = Input.InClass(`void Foo() { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Type("void"),
                Tokens.Identifiers.MethodName("Foo"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("declaration with two parameters", () => {

            const input = Input.InClass(`
int Add(int x, int y)
{
    return x + y;
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Type("int"),
                Tokens.Identifiers.MethodName("Add"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Type("int"),
                Tokens.Variables.Parameter("x"),
                Tokens.Puncuation.Comma,
                Tokens.Type("int"),
                Tokens.Variables.Parameter("y"),
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Keywords.Return,
                Tokens.Variables.ReadWrite("x"),
                Tokens.Operators.Arithmetic.Addition,
                Tokens.Variables.ReadWrite("y"),
                Tokens.Puncuation.Semicolon,
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("expression body", () => {

            const input = Input.InClass(`int Add(int x, int y) => x + y;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Type("int"),
                Tokens.Identifiers.MethodName("Add"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Type("int"),
                Tokens.Variables.Parameter("x"),
                Tokens.Puncuation.Comma,
                Tokens.Type("int"),
                Tokens.Variables.Parameter("y"),
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Operators.Arrow,
                Tokens.Variables.ReadWrite("x"),
                Tokens.Operators.Arithmetic.Addition,
                Tokens.Variables.ReadWrite("y"),
                Tokens.Puncuation.Semicolon]);
        });
    });
});