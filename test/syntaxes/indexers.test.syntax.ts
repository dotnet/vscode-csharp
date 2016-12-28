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
                Token.Variables.ReadWrite("index"),
                Token.Variables.ReadWrite("ToString"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace,
                Token.Puncuation.CloseBrace]);
        });
    });
});