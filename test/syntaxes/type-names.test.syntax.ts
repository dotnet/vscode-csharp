/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Type names", () => {
        it("built-in type - object", () => {

            const input = Input.InClass(`object x;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("object"),
                Token.Identifiers.FieldName("x"),
                Token.Puncuation.Semicolon]);
        });

        it("qualified name - System.Object", () => {

            const input = Input.InClass(`System.Object x;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("System"),
                Token.Puncuation.Accessor,
                Token.Type("Object"),
                Token.Identifiers.FieldName("x"),
                Token.Puncuation.Semicolon]);
        });

        it("globally-qualified name - global::System.Object", () => {

            const input = Input.InClass(`global::System.Object x;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.AliasName("global"),
                Token.Puncuation.ColonColon,
                Token.Type("System"),
                Token.Puncuation.Accessor,
                Token.Type("Object"),
                Token.Identifiers.FieldName("x"),
                Token.Puncuation.Semicolon]);
        });

        it("tuple type - (int, int)", () => {

            const input = Input.InClass(`(int, int) x;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Puncuation.CloseParen,
                Token.Identifiers.FieldName("x"),
                Token.Puncuation.Semicolon]);
        });

        it("generic type - List<int>", () => {

            const input = Input.InClass(`List<int> x;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("List"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("int"),
                Token.Puncuation.TypeParameters.End,
                Token.Identifiers.FieldName("x"),
                Token.Puncuation.Semicolon]);
        });

        it("generic type with tuple - List<(int, int)>", () => {

            const input = Input.InClass(`List<(int, int)> x;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("List"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.TypeParameters.End,
                Token.Identifiers.FieldName("x"),
                Token.Puncuation.Semicolon]);
        });

        it("generic type with multiple parameters - Dictionary<int, int>", () => {

            const input = Input.InClass(`Dictionary<int, int> x;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("Dictionary"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("int"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Puncuation.TypeParameters.End,
                Token.Identifiers.FieldName("x"),
                Token.Puncuation.Semicolon]);
        });

        it("qualified generic type - System.Collections.Generic.List<int>", () => {

            const input = Input.InClass(`System.Collections.Generic.List<int> x;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("System"),
                Token.Puncuation.Accessor,
                Token.Type("Collections"),
                Token.Puncuation.Accessor,
                Token.Type("Generic"),
                Token.Puncuation.Accessor,
                Token.Type("List"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("int"),
                Token.Puncuation.TypeParameters.End,
                Token.Identifiers.FieldName("x"),
                Token.Puncuation.Semicolon]);
        });

        it("generic type with nested type - List<int>.Enumerator", () => {

            const input = Input.InClass(`List<int>.Enumerator x;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("List"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("int"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.Accessor,
                Token.Type("Enumerator"),
                Token.Identifiers.FieldName("x"),
                Token.Puncuation.Semicolon]);
        });
    });
});