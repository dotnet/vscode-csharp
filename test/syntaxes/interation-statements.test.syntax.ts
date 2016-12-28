/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe.skip("Iteration statements (loops)", () => {
        it("single-line declaration with no parameters", () => {

            const input = Input.InMethod(`
while (true) { }
`);

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("void"),
                Tokens.Identifiers.MethodName("Foo"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Puncuation.CurlyBrace.Close]);
        });
    });
});