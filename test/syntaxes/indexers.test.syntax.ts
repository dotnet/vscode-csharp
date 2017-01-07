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
                Token.Puncuation.OpenBracket,
                Token.Type("int"),
                Token.Variables.Parameter("index"),
                Token.Puncuation.CloseBracket,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Get,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.Object("index"),
                Token.Puncuation.Accessor,
                Token.Identifiers.MethodName("ToString"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace,
                Token.Puncuation.CloseBrace]);
        });

        it("explicitly-implemented interface member", () => {

            const input = Input.InClass(`string IFoo<string>.this[int index];`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Type("IFoo"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("string"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.Accessor,
                Token.Keywords.This,
                Token.Puncuation.OpenBracket,
                Token.Type("int"),
                Token.Variables.Parameter("index"),
                Token.Puncuation.CloseBracket,
                Token.Puncuation.Semicolon]);
        });

        it("declaration in interface", () => {

            const input = Input.InInterface(`string this[int index] { get; set; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Keywords.This,
                Token.Puncuation.OpenBracket,
                Token.Type("int"),
                Token.Variables.Parameter("index"),
                Token.Puncuation.CloseBracket,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Get,
                Token.Puncuation.Semicolon,
                Token.Keywords.Set,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("declaration in interface (read-only)", () => {

            const input = Input.InInterface(`string this[int index] { get; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Keywords.This,
                Token.Puncuation.OpenBracket,
                Token.Type("int"),
                Token.Variables.Parameter("index"),
                Token.Puncuation.CloseBracket,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Get,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("declaration in interface (write-only)", () => {

            const input = Input.InInterface(`string this[int index] { set; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Keywords.This,
                Token.Puncuation.OpenBracket,
                Token.Type("int"),
                Token.Variables.Parameter("index"),
                Token.Puncuation.CloseBracket,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Set,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });
    });
});