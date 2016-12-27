/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { Tokens } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe("Indexers", () => {
        it("declaration", () => {

            const input = `
class Tester
{
    public string this[int index]
    {
        get { return index.ToString(); }
    }
}`;
            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("Tester", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

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
                Tokens.Puncuation.Semicolon(6, 38),
                Tokens.Puncuation.CurlyBrace.Close(6, 40),
                Tokens.Puncuation.CurlyBrace.Close(7, 5),

                Tokens.Puncuation.CurlyBrace.Close(8, 1)]);
        });
    });
});
