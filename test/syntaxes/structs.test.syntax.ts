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

            const input = `
struct S { }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Struct(2, 1),
                Tokens.Identifiers.StructName("S", 2, 8),
                Tokens.Puncuation.CurlyBrace.Open(2, 10),
                Tokens.Puncuation.CurlyBrace.Close(2, 12)]);
        });

        it("struct interface implementation", () => {

            const input = `
interface IFoo { }
struct S : IFoo { }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Interface(2, 1),
                Tokens.Identifiers.InterfaceName("IFoo", 2, 11),
                Tokens.Puncuation.CurlyBrace.Open(2, 16),
                Tokens.Puncuation.CurlyBrace.Close(2, 18),
                Tokens.Keywords.Struct(3, 1),
                Tokens.Identifiers.StructName("S", 3, 8),
                Tokens.Puncuation.Colon(3, 10),
                Tokens.Type("IFoo", 3, 12),
                Tokens.Puncuation.CurlyBrace.Open(3, 17),
                Tokens.Puncuation.CurlyBrace.Close(3, 19)]);
        });

        it("generic struct", () => {

            const input = `
struct S<T1, T2> { }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Struct(2, 1),
                Tokens.Identifiers.StructName("S<T1, T2>", 2, 8),
                Tokens.Puncuation.CurlyBrace.Open(2, 18),
                Tokens.Puncuation.CurlyBrace.Close(2, 20)]);
        });

        it("generic struct with constraints", () => {

            const input = `
struct S<T1, T2> where T1 : T2 { }
`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Struct(2, 1),
                Tokens.Identifiers.StructName("S<T1, T2>", 2, 8),
                Tokens.Keywords.Where(2, 18),
                Tokens.Type("T1", 2, 24),
                Tokens.Puncuation.Colon(2, 27),
                Tokens.Type("T2", 2, 29),
                Tokens.Puncuation.CurlyBrace.Open(2, 32),
                Tokens.Puncuation.CurlyBrace.Close(2, 34)]);
        });
    });
});