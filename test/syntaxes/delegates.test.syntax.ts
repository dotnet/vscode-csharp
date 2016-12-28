/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Delegates", () => {
        it("void delegate with no parameters", () => {

            const input = `delegate void D();`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Delegate,
                Tokens.Type("void"),
                Tokens.Identifiers.DelegateName("D"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Puncuation.Semicolon]);
        });

        it("generic delegate with variance", () => {

            const input = `delegate TResult D<in T, out TResult>(T arg1);`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Delegate,
                Tokens.Type("TResult"),
                Tokens.Identifiers.DelegateName("D<in T, out TResult>"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Type("T"),
                Tokens.Variables.Parameter("arg1"),
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Puncuation.Semicolon]);
        });

        it("generic delegate with constraints", () => {

            const input = `
delegate void D<T1, T2>()
    where T1 : T2;
`;

            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Delegate,
                Tokens.Type("void"),
                Tokens.Identifiers.DelegateName("D<T1, T2>"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Keywords.Where,
                Tokens.Type("T1"),
                Tokens.Puncuation.Colon,
                Tokens.Type("T2"),
                Tokens.Puncuation.Semicolon]);
        });

        it("delegate with multiple parameters", () => {

            const input = `delegate int D(ref string x, out int y, params object[] z);`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Delegate,
                Tokens.Type("int"),
                Tokens.Identifiers.DelegateName("D"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Keywords.Modifiers.Ref,
                Tokens.Type("string"),
                Tokens.Variables.Parameter("x"),
                Tokens.Puncuation.Comma,
                Tokens.Keywords.Modifiers.Out,
                Tokens.Type("int"),
                Tokens.Variables.Parameter("y"),
                Tokens.Puncuation.Comma,
                Tokens.Keywords.Modifiers.Params,
                Tokens.Type("object"),
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Puncuation.SquareBracket.Close,
                Tokens.Variables.Parameter("z"),
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Puncuation.Semicolon]);
        });
    });
});