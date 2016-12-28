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
                Tokens.Keywords.Interface,
                Tokens.Identifiers.InterfaceName("IFoo"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("interface inheritance", () => {

            const input = `
interface IFoo { }
interface IBar : IFoo { }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Interface,
                Tokens.Identifiers.InterfaceName("IFoo"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,
                Tokens.Keywords.Interface,
                Tokens.Identifiers.InterfaceName("IBar"),
                Tokens.Puncuation.Colon,
                Tokens.Type("IFoo"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("generic interface", () => {

            const input = `
interface IFoo<T1, T2> { }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Interface,
                Tokens.Identifiers.InterfaceName("IFoo<T1, T2>"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("generic interface with variance", () => {

            const input = `
interface IFoo<in T1, out T2> { }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Interface,
                Tokens.Identifiers.InterfaceName("IFoo<in T1, out T2>"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("generic interface with constraints", () => {

            const input = `
interface IFoo<T1, T2> where T1 : T2 { }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Interface,
                Tokens.Identifiers.InterfaceName("IFoo<T1, T2>"),
                Tokens.Keywords.Where,
                Tokens.Type("T1"),
                Tokens.Puncuation.Colon,
                Tokens.Type("T2"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
        });
    });
});