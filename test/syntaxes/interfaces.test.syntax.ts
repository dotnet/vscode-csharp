/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Interfaces", () => {
        it("simple interface", () => {

            const input = `
interface IFoo { }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Interface(2, 1),
                Tokens.Identifiers.InterfaceName("IFoo", 2, 11),
                Tokens.Puncuation.CurlyBrace.Open(2, 16),
                Tokens.Puncuation.CurlyBrace.Close(2, 18)]);
        });

        it("interface inheritance", () => {

            const input = `
interface IFoo { }
interface IBar : IFoo { }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Interface(2, 1),
                Tokens.Identifiers.InterfaceName("IFoo", 2, 11),
                Tokens.Puncuation.CurlyBrace.Open(2, 16),
                Tokens.Puncuation.CurlyBrace.Close(2, 18),
                Tokens.Keywords.Interface(3, 1),
                Tokens.Identifiers.InterfaceName("IBar", 3, 11),
                Tokens.Puncuation.Colon(3, 16),
                Tokens.Type("IFoo", 3, 18),
                Tokens.Puncuation.CurlyBrace.Open(3, 23),
                Tokens.Puncuation.CurlyBrace.Close(3, 25)]);
        });

        it("generic interface", () => {

            const input = `
interface IFoo<T1, T2> { }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Interface(2, 1),
                Tokens.Identifiers.InterfaceName("IFoo<T1, T2>", 2, 11),
                Tokens.Puncuation.CurlyBrace.Open(2, 24),
                Tokens.Puncuation.CurlyBrace.Close(2, 26)]);
        });

        it("generic interface with variance", () => {

            const input = `
interface IFoo<in T1, out T2> { }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Interface(2, 1),
                Tokens.Identifiers.InterfaceName("IFoo<in T1, out T2>", 2, 11),
                Tokens.Puncuation.CurlyBrace.Open(2, 31),
                Tokens.Puncuation.CurlyBrace.Close(2, 33)]);
        });

        it("generic interface with constraints", () => {

            const input = `
interface IFoo<T1, T2> where T1 : T2 { }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Interface(2, 1),
                Tokens.Identifiers.InterfaceName("IFoo<T1, T2>", 2, 11),
                Tokens.Keywords.Where(2, 24),
                Tokens.Type("T1", 2, 30),
                Tokens.Puncuation.Colon(2, 33),
                Tokens.Type("T2", 2, 35),
                Tokens.Puncuation.CurlyBrace.Open(2, 38),
                Tokens.Puncuation.CurlyBrace.Close(2, 40)]);
        });
    });
});