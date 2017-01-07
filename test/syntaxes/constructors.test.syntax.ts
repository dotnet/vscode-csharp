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
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("instance constructor with two parameters", () => {

            const input = Input.InClass(`
TestClass(int x, int y)
{
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("TestClass"),
                Token.Punctuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Punctuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("instance constructor with expression body", () => {

            const input = Input.InClass(`TestClass(int x, int y) => Foo();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("TestClass"),
                Token.Punctuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Punctuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Identifiers.MethodName("Foo"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon]);
        });

        it("static constructor no parameters", () => {

            const input = Input.InClass(`TestClass() { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("TestClass"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("instance constructor with 'this' initializer", () => {

            const input = Input.InClass(`TestClass() : this(42) { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("TestClass"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Colon,
                Token.Keywords.This,
                Token.Punctuation.OpenParen,
                Token.Literals.Numeric.Decimal("42"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("instance constructor with 'this' initializer with ref parameter", () => {

            const input = Input.InClass(`TestClass(int x) : this(ref x) { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("TestClass"),
                Token.Punctuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.Colon,
                Token.Keywords.This,
                Token.Punctuation.OpenParen,
                Token.Keywords.Modifiers.Ref,
                Token.Variables.ReadWrite("x"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("instance constructor with 'this' initializer with named parameter", () => {

            const input = Input.InClass(`TestClass(int x) : this(y: x) { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("TestClass"),
                Token.Punctuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.Colon,
                Token.Keywords.This,
                Token.Punctuation.OpenParen,
                Token.Variables.Parameter("y"),
                Token.Punctuation.Colon,
                Token.Variables.ReadWrite("x"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("instance constructor with 'base' initializer", () => {

            const input = Input.InClass(`TestClass() : base(42) { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("TestClass"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Colon,
                Token.Keywords.Base,
                Token.Punctuation.OpenParen,
                Token.Literals.Numeric.Decimal("42"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
        });
    });
});