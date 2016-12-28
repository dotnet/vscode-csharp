/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Structs", () => {
        it("simple struct", () => {

            const input = `struct S { }`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Struct,
                Token.Identifiers.StructName("S"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace]);
        });

        it("struct interface implementation", () => {

            const input = `
interface IFoo { }
struct S : IFoo { }
`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Interface,
                Token.Identifiers.InterfaceName("IFoo"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,
                Token.Keywords.Struct,
                Token.Identifiers.StructName("S"),
                Token.Puncuation.Colon,
                Token.Type("IFoo"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace]);
        });

        it("generic struct", () => {

            const input = `
struct S<T1, T2> { }
`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Struct,
                Token.Identifiers.StructName("S<T1, T2>"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace]);
        });

        it("generic struct with constraints", () => {

            const input = `
struct S<T1, T2> where T1 : T2 { }
`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Struct,
                Token.Identifiers.StructName("S<T1, T2>"),
                Token.Keywords.Where,
                Token.Type("T1"),
                Token.Puncuation.Colon,
                Token.Type("T2"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace]);
        });
    });
});