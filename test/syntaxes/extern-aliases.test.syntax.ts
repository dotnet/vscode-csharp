/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Extern aliases", () => {
        it("simple", () => {

            const input = `
extern alias X;
extern alias Y;`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Extern,
                Tokens.Keywords.Alias,
                Tokens.Variables.Alias("X"),
                Tokens.Puncuation.Semicolon,
                Tokens.Keywords.Extern,
                Tokens.Keywords.Alias,
                Tokens.Variables.Alias("Y"),
                Tokens.Puncuation.Semicolon]);
        });
    });
});