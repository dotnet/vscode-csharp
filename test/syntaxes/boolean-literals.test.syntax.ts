/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Literals - boolean", () => {
        it("true", () => {

            const input = `
class C {
    bool x = true;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("C"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("bool"),
                Tokens.Identifiers.FieldName("x"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Boolean.True,
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("false", () => {

            const input = `
class C {
    bool x = false;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("C"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("bool"),
                Tokens.Identifiers.FieldName("x"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Boolean.False,
                Tokens.Puncuation.Semicolon,
                
                Tokens.Puncuation.CurlyBrace.Close]);
        });
    });
});