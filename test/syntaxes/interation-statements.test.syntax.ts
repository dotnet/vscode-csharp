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
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("Tester", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Type("void", 4, 5),
                Tokens.Identifiers.MethodName("Foo", 4, 10),
                Tokens.Puncuation.Parenthesis.Open(4, 13),
                Tokens.Puncuation.Parenthesis.Close(4, 14),
                Tokens.Puncuation.CurlyBrace.Open(5, 5),
                Tokens.Puncuation.CurlyBrace.Close(7, 5),

                Tokens.Puncuation.CurlyBrace.Close(8, 1)]);
        });
    });
});