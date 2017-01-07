/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Using statements", () => {
        it("single-line using with expression and embedded statement", () => {
            const input = Input.InMethod(`using (new object()) Do();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Using,
                Token.Punctuation.OpenParen,
                Token.Keywords.New,
                Token.Type("object"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.CloseParen,
                Token.Identifiers.MethodName("Do"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("single-line using with expression and block", () => {
            const input = Input.InMethod(`using (new object()) { Do(); }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Using,
                Token.Punctuation.OpenParen,
                Token.Keywords.New,
                Token.Type("object"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Identifiers.MethodName("Do"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("using with expression and embedded statement", () => {
            const input = Input.InMethod(`
using (new object())
    Do();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Using,
                Token.Punctuation.OpenParen,
                Token.Keywords.New,
                Token.Type("object"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.CloseParen,
                Token.Identifiers.MethodName("Do"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("using with expression and block", () => {
            const input = Input.InMethod(`
using (new object())
{
    Do();
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Using,
                Token.Punctuation.OpenParen,
                Token.Keywords.New,
                Token.Type("object"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Identifiers.MethodName("Do"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace
            ]);
        });
        
        it("using with local variable and embedded statement", () => {
            const input = Input.InMethod(`
using (var o = new object())
    Do();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Using,
                Token.Punctuation.OpenParen,
                Token.Type("var"),
                Token.Variables.Local("o"),
                Token.Operators.Assignment,
                Token.Keywords.New,
                Token.Type("object"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.CloseParen,
                Token.Identifiers.MethodName("Do"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("using with local variable and block", () => {
            const input = Input.InMethod(`
using (var o = new object())
{
    Do();
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Using,
                Token.Punctuation.OpenParen,
                Token.Type("var"),
                Token.Variables.Local("o"),
                Token.Operators.Assignment,
                Token.Keywords.New,
                Token.Type("object"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Identifiers.MethodName("Do"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace
            ]);
        });
    });
});