/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Structs", () => {
        it("simple struct", () => {

            const input = `struct S { }`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Struct,
                Tokens.Identifiers.StructName("S"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("struct interface implementation", () => {

            const input = `
interface IFoo { }
struct S : IFoo { }
`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Interface,
                Tokens.Identifiers.InterfaceName("IFoo"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,
                Tokens.Keywords.Struct,
                Tokens.Identifiers.StructName("S"),
                Tokens.Puncuation.Colon,
                Tokens.Type("IFoo"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("generic struct", () => {

            const input = `
struct S<T1, T2> { }
`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Struct,
                Tokens.Identifiers.StructName("S<T1, T2>"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("generic struct with constraints", () => {

            const input = `
struct S<T1, T2> where T1 : T2 { }
`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Struct,
                Tokens.Identifiers.StructName("S<T1, T2>"),
                Tokens.Keywords.Where,
                Tokens.Type("T1"),
                Tokens.Puncuation.Colon,
                Tokens.Type("T2"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
        });
    });
});