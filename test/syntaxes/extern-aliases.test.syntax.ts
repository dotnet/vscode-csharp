/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { Tokens } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe("Extern aliases", () => {
        it("simple", () => {

            const input = `
extern alias X;
extern alias Y;`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Extern(2, 1),
                Tokens.Keywords.Alias(2, 8),
                Tokens.Variables.Alias("X", 2, 14),
                Tokens.Puncuation.Semicolon(2, 15),
                Tokens.Keywords.Extern(3, 1),
                Tokens.Keywords.Alias(3, 8),
                Tokens.Variables.Alias("Y", 3, 14),
                Tokens.Puncuation.Semicolon(3, 15)]);
        });
    });
});