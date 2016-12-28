/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Tokens } from './utils/tokenizer';

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
                Tokens.Keywords.Modifiers.Public,
                Tokens.Type("string"),
                Tokens.Keywords.This,
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Type("int"),
                Tokens.Variables.Parameter("index"),
                Tokens.Puncuation.SquareBracket.Close,
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Keywords.Get,
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Keywords.Return,
                Tokens.Variables.ReadWrite("index"),
                Tokens.Variables.ReadWrite("ToString"),
                Tokens.Puncuation.Semicolon,
                Tokens.Puncuation.CurlyBrace.Close,
                Tokens.Puncuation.CurlyBrace.Close]);
        });
    });
});