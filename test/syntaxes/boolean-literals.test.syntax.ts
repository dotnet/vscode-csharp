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
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("C", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(2, 9),

                Tokens.Type("bool", 3, 5),
                Tokens.Identifiers.FieldName("x", 3, 10),
                Tokens.Operators.Assignment(3, 12),
                Tokens.Literals.Boolean.True(3, 14),
                Tokens.Puncuation.Semicolon(3, 18),

                Tokens.Puncuation.CurlyBrace.Close(4, 1)]);
        });

        it("false", () => {

            const input = `
class C {
    bool x = false;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("C", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(2, 9),

                Tokens.Type("bool", 3, 5),
                Tokens.Identifiers.FieldName("x", 3, 10),
                Tokens.Operators.Assignment(3, 12),
                Tokens.Literals.Boolean.False(3, 14),
                Tokens.Puncuation.Semicolon(3, 19),
                
                Tokens.Puncuation.CurlyBrace.Close(4, 1)]);
        });
    });
});