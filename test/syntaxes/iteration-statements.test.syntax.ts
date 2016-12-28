/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Iteration statements (loops)", () => {
        it("single-line while loop", () => {
            const input = Input.InMethod(`while (true) { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.While,
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace
            ]);
        });

        it("single-line do..while loop", () => {

            const input = Input.InMethod(`do { } while (true);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Do,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,
                Token.Keywords.While,
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });
    });
});