/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Extern aliases", () => {
        it("declaration", () => {

            const input = `
extern alias X;
extern alias Y;`;

            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Extern,
                Token.Keywords.Alias,
                Token.Variables.Alias("X"),
                Token.Punctuation.Semicolon,
                Token.Keywords.Extern,
                Token.Keywords.Alias,
                Token.Variables.Alias("Y"),
                Token.Punctuation.Semicolon]);
        });
    });
});