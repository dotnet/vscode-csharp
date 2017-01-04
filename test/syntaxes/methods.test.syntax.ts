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
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace]);
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
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Arithmetic.Addition,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("declaration in with generic constraints", () => {

            const input = Input.InClass(`TResult GetString<T, TResult>(T arg) where T : TResult { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("TResult"),
                Token.Identifiers.MethodName("GetString<T, TResult>"),
                Token.Puncuation.OpenParen,
                Token.Type("T"),
                Token.Variables.Parameter("arg"),
                Token.Puncuation.CloseParen,
                Token.Keywords.Where,
                Token.Type("T"),
                Token.Puncuation.Colon,
                Token.Type("TResult"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace]);
        });

        it("expression body", () => {

            const input = Input.InClass(`int Add(int x, int y) => x + y;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("int"),
                Token.Identifiers.MethodName("Add"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Operators.Arrow,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Arithmetic.Addition,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon]);
        });

        it("explicitly-implemented interface member", () => {

            const input = Input.InClass(`string IFoo<string>.GetString();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Type("IFoo"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("string"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.Accessor,
                Token.Identifiers.MethodName("GetString"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon]);
        });

        it("declaration in interface", () => {

            const input = Input.InInterface(`string GetString();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Identifiers.MethodName("GetString"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon]);
        });

        it("declaration in interface with parameters", () => {

            const input = Input.InInterface(`string GetString(string format, params object[] args);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Identifiers.MethodName("GetString"),
                Token.Puncuation.OpenParen,
                Token.Type("string"),
                Token.Variables.Parameter("format"),
                Token.Puncuation.Comma,
                Token.Keywords.Modifiers.Params,
                Token.Type("object"),
                Token.Puncuation.OpenBracket,
                Token.Puncuation.CloseBracket,
                Token.Variables.Parameter("args"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon]);
        });

        it("declaration in interface with generic constraints", () => {

            const input = Input.InInterface(`TResult GetString<T, TResult>(T arg) where T : TResult;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("TResult"),
                Token.Identifiers.MethodName("GetString<T, TResult>"),
                Token.Puncuation.OpenParen,
                Token.Type("T"),
                Token.Variables.Parameter("arg"),
                Token.Puncuation.CloseParen,
                Token.Keywords.Where,
                Token.Type("T"),
                Token.Puncuation.Colon,
                Token.Type("TResult"),
                Token.Puncuation.Semicolon]);
        });
    });
});