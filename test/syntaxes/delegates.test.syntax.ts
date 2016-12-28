/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { Tokens } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe("Delegates", () => {
        it("void delegate with no parameters", () => {

            const input = `
delegate void D();
`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Delegate(2, 1),
                Tokens.Type("void", 2, 10),
                Tokens.Identifiers.DelegateName("D", 2, 15),
                Tokens.Puncuation.Parenthesis.Open(2, 16),
                Tokens.Puncuation.Parenthesis.Close(2, 17),
                Tokens.Puncuation.Semicolon(2, 18)]);
        });

        it("generic delegate with variance", () => {

            const input = `
delegate TResult D<in T, out TResult>(T arg1);
`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Delegate(2, 1),
                Tokens.Type("TResult", 2, 10),
                Tokens.Identifiers.DelegateName("D<in T, out TResult>", 2, 18),
                Tokens.Puncuation.Parenthesis.Open(2, 38),
                Tokens.Type("T", 2, 39),
                Tokens.Variables.Parameter("arg1", 2, 41),
                Tokens.Puncuation.Parenthesis.Close(2, 45),
                Tokens.Puncuation.Semicolon(2, 46)]);
        });

        it("generic delegate with constraints", () => {

            const input = `
delegate void D<T1, T2>()
    where T1 : T2;
`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Delegate(2, 1),
                Tokens.Type("void", 2, 10),
                Tokens.Identifiers.DelegateName("D<T1, T2>", 2, 15),
                Tokens.Puncuation.Parenthesis.Open(2, 24),
                Tokens.Puncuation.Parenthesis.Close(2, 25),
                Tokens.Keywords.Where(3, 5),
                Tokens.Type("T1", 3, 11),
                Tokens.Puncuation.Colon(3, 14),
                Tokens.Type("T2", 3, 16),
                Tokens.Puncuation.Semicolon(3, 18)]);
        });

        it("delegate with multiple parameters", () => {

            const input = `
delegate int D(ref string x, out int y, params object[] z);
`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Delegate(2, 1),
                Tokens.Type("int", 2, 10),
                Tokens.Identifiers.DelegateName("D", 2, 14),
                Tokens.Puncuation.Parenthesis.Open(2, 15),
                Tokens.Keywords.Modifiers.Ref(2, 16),
                Tokens.Type("string", 2, 20),
                Tokens.Variables.Parameter("x", 2, 27),
                Tokens.Puncuation.Comma(2, 28),
                Tokens.Keywords.Modifiers.Out(2, 30),
                Tokens.Type("int", 2, 34),
                Tokens.Variables.Parameter("y", 2, 38),
                Tokens.Puncuation.Comma(2, 39),
                Tokens.Keywords.Modifiers.Params(2, 41),
                Tokens.Type("object", 2, 48),
                Tokens.Puncuation.SquareBracket.Open(2, 54),
                Tokens.Puncuation.SquareBracket.Close(2, 55),
                Tokens.Variables.Parameter("z", 2, 57),
                Tokens.Puncuation.Parenthesis.Close(2, 58),
                Tokens.Puncuation.Semicolon(2, 59)]);
        });
    });
});


