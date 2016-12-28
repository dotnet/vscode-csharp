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
                Tokens.Keywords.Modifiers.Public(4, 5),
                Tokens.Type("string", 4, 12),
                Tokens.Keywords.This(4, 19),
                Tokens.Puncuation.SquareBracket.Open(4, 23),
                Tokens.Type("int", 4, 24),
                Tokens.Variables.Parameter("index", 4, 28),
                Tokens.Puncuation.SquareBracket.Close(4, 33),
                Tokens.Puncuation.CurlyBrace.Open(5, 5),
                Tokens.Keywords.Get(6, 9),
                Tokens.Puncuation.CurlyBrace.Open(6, 13),
                Tokens.Keywords.Return(6, 15),
                Tokens.Variables.ReadWrite("index", 6, 22),
                Tokens.Variables.ReadWrite("ToString", 6, 28),
                Tokens.Puncuation.Semicolon(6, 38),
                Tokens.Puncuation.CurlyBrace.Close(6, 40),
                Tokens.Puncuation.CurlyBrace.Close(7, 5)]);
        });
    });
});