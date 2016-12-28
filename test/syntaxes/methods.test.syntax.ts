/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Methods", () => {
        it("single-line declaration with no parameters", () => {

            const input = `
class Tester
{
    void Foo() { }
}`;
            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("Tester", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Type("void", 4, 5),
                Tokens.Identifiers.MethodName("Foo", 4, 10),
                Tokens.Puncuation.Parenthesis.Open(4, 13),
                Tokens.Puncuation.Parenthesis.Close(4, 14),
                Tokens.Puncuation.CurlyBrace.Open(4, 16),
                Tokens.Puncuation.CurlyBrace.Close(4, 18),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
        });

        it("declaration with two parameters", () => {

            const input = `
class Tester
{
    int Add(int x, int y)
    {
        return x + y;
    }
}`;
            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("Tester", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Type("int", 4, 5),
                Tokens.Identifiers.MethodName("Add", 4, 9),
                Tokens.Puncuation.Parenthesis.Open(4, 12),
                Tokens.Type("int", 4, 13),
                Tokens.Variables.Parameter("x", 4, 17),
                Tokens.Puncuation.Comma(4, 18),
                Tokens.Type("int", 4, 20),
                Tokens.Variables.Parameter("y", 4, 24),
                Tokens.Puncuation.Parenthesis.Close(4, 25),
                Tokens.Puncuation.CurlyBrace.Open(5, 5),
                Tokens.Puncuation.Semicolon(6, 21),
                Tokens.Puncuation.CurlyBrace.Close(7, 5),

                Tokens.Puncuation.CurlyBrace.Close(8, 1)]);
        });
    });
});