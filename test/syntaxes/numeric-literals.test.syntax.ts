/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { Tokens } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe.skip("Literals - numeric", () => {
        it("decimal zero", () => {

            const input = `
class C {
    method M() {
        var x = 0;
    }
}`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.Puncuation.SquareBracket.Open(2, 1));
            tokens.should.contain(Tokens.Type("Foo", 2, 2));
            tokens.should.contain(Tokens.Puncuation.SquareBracket.Close(2, 5));
        });
    });
});