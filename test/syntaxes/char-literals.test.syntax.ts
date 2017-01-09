/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Literals - char", () => {
        it("empty", () => {
            const input = Input.InMethod(`var x = '';`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Var,
                Token.Variables.Local("x"),
                Token.Operators.Assignment,
                Token.Punctuation.Char.Begin,
                Token.Punctuation.Char.End,
                Token.Punctuation.Semicolon]);
        });

        it("letter", () => {
            const input = Input.InMethod(`var x = 'a';`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Var,
                Token.Variables.Local("x"),
                Token.Operators.Assignment,
                Token.Punctuation.Char.Begin,
                Token.Literals.Char("a"),
                Token.Punctuation.Char.End,
                Token.Punctuation.Semicolon]);
        });

        it("escaped single quote", () => {
            const input = Input.InMethod(`var x = '\\'';`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Var,
                Token.Variables.Local("x"),
                Token.Operators.Assignment,
                Token.Punctuation.Char.Begin,
                Token.Literals.CharacterEscape("\\'"),
                Token.Punctuation.Char.End,
                Token.Punctuation.Semicolon]);
        });
    });
});