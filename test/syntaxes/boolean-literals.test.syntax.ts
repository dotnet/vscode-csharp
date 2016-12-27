/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { Tokens } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe.skip("Literals - boolean", () => {
        it("true", () => {

            const input = `
class C {
    method M() {
        var x = true;
    }
}`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("C", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(2, 9),
                Tokens.Literals.Boolean.True(4, 17),
                Tokens.Puncuation.CurlyBrace.Close(6, 1)]);
        });

        it("false", () => {

            const input = `
class C {
    method M() {
        var x = false;
    }
}`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("C", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(2, 9),
                Tokens.Literals.Boolean.False(4, 17),
                Tokens.Puncuation.CurlyBrace.Close(6, 1)]);
        });
    });
});