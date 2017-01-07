/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Indexers", () => {
        it("declaration", () => {

            const input = Input.InClass(`
public string this[int index]
{
    get { return index.ToString(); }
}`);

            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Type("string"),
                Token.Keywords.This,
                Token.Punctuation.OpenBracket,
                Token.Type("int"),
                Token.Variables.Parameter("index"),
                Token.Punctuation.CloseBracket,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Get,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.Object("index"),
                Token.Punctuation.Accessor,
                Token.Identifiers.MethodName("ToString"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("explicitly-implemented interface member", () => {

            const input = Input.InClass(`string IFoo<string>.this[int index];`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Type("IFoo"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("string"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.Accessor,
                Token.Keywords.This,
                Token.Punctuation.OpenBracket,
                Token.Type("int"),
                Token.Variables.Parameter("index"),
                Token.Punctuation.CloseBracket,
                Token.Punctuation.Semicolon]);
        });

        it("declaration in interface", () => {

            const input = Input.InInterface(`string this[int index] { get; set; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Keywords.This,
                Token.Punctuation.OpenBracket,
                Token.Type("int"),
                Token.Variables.Parameter("index"),
                Token.Punctuation.CloseBracket,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Get,
                Token.Punctuation.Semicolon,
                Token.Keywords.Set,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace]);
        });

        it("declaration in interface (read-only)", () => {

            const input = Input.InInterface(`string this[int index] { get; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Keywords.This,
                Token.Punctuation.OpenBracket,
                Token.Type("int"),
                Token.Variables.Parameter("index"),
                Token.Punctuation.CloseBracket,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Get,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace]);
        });

        it("declaration in interface (write-only)", () => {

            const input = Input.InInterface(`string this[int index] { set; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Keywords.This,
                Token.Punctuation.OpenBracket,
                Token.Type("int"),
                Token.Variables.Parameter("index"),
                Token.Punctuation.CloseBracket,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Set,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace]);
        });
    });
});