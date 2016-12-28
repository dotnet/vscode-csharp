/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Delegates", () => {
        it("void delegate with no parameters", () => {

            const input = `delegate void D();`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Delegate,
                Token.Type("void"),
                Token.Identifiers.DelegateName("D"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon]);
        });

        it("generic delegate with variance", () => {

            const input = `delegate TResult D<in T, out TResult>(T arg1);`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Delegate,
                Token.Type("TResult"),
                Token.Identifiers.DelegateName("D<in T, out TResult>"),
                Token.Puncuation.OpenParen,
                Token.Type("T"),
                Token.Variables.Parameter("arg1"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon]);
        });

        it("generic delegate with constraints", () => {

            const input = `
delegate void D<T1, T2>()
    where T1 : T2;
`;

            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Delegate,
                Token.Type("void"),
                Token.Identifiers.DelegateName("D<T1, T2>"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Keywords.Where,
                Token.Type("T1"),
                Token.Puncuation.Colon,
                Token.Type("T2"),
                Token.Puncuation.Semicolon]);
        });

        it("delegate with multiple parameters", () => {

            const input = `delegate int D(ref string x, out int y, params object[] z);`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Delegate,
                Token.Type("int"),
                Token.Identifiers.DelegateName("D"),
                Token.Puncuation.OpenParen,
                Token.Keywords.Modifiers.Ref,
                Token.Type("string"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Keywords.Modifiers.Out,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.Comma,
                Token.Keywords.Modifiers.Params,
                Token.Type("object"),
                Token.Puncuation.OpenBracket,
                Token.Puncuation.CloseBracket,
                Token.Variables.Parameter("z"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon]);
        });
    });
});