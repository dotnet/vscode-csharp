/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Lock statements", () => {
        it("single-line lock with embedded statement", () => {
            const input = Input.InMethod(`lock (new object()) Do();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Lock,
                Token.Puncuation.OpenParen,
                Token.Keywords.New,
                Token.Type("object"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.CloseParen,
                Token.Identifiers.MethodName("Do"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("single-line lock with block", () => {
            const input = Input.InMethod(`lock (new object()) { Do(); }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Lock,
                Token.Puncuation.OpenParen,
                Token.Keywords.New,
                Token.Type("object"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Identifiers.MethodName("Do"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace
            ]);
        });

        it("lock with embedded statement", () => {
            const input = Input.InMethod(`
lock (new object())
    Do();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Lock,
                Token.Puncuation.OpenParen,
                Token.Keywords.New,
                Token.Type("object"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.CloseParen,
                Token.Identifiers.MethodName("Do"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("lock with block", () => {
            const input = Input.InMethod(`
lock (new object())
{
    Do();
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Lock,
                Token.Puncuation.OpenParen,
                Token.Keywords.New,
                Token.Type("object"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Identifiers.MethodName("Do"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace
            ]);
        });
    });
});