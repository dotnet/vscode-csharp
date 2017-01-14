/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Using directives", () => {
        it("using namespace", () => {

            const input = `using System;`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Using,
                Token.Identifiers.NamespaceName("System"),
                Token.Punctuation.Semicolon]);
        });

        it("using static type", () => {

            const input = `using static System.Console;`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Using,
                Token.Keywords.Static,
                Token.Type("System"),
                Token.Punctuation.Accessor,
                Token.Type("Console"),
                Token.Punctuation.Semicolon]);
        });

        it("namespace alias", () => {

            const input = `using S = System;`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Using,
                Token.Identifiers.AliasName("S"),
                Token.Operators.Assignment,
                Token.Type("System"),
                Token.Punctuation.Semicolon]);
        });

        it("type alias", () => {

            const input = `using C = System.Console;`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Using,
                Token.Identifiers.AliasName("C"),
                Token.Operators.Assignment,
                Token.Type("System"),
                Token.Punctuation.Accessor,
                Token.Type("Console"),
                Token.Punctuation.Semicolon]);
        });

        it("type alias with generic type", () => {

            const input = `using IntList = System.Collections.Generic.List<System.Int32>;`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Using,
                Token.Identifiers.AliasName("IntList"),
                Token.Operators.Assignment,
                Token.Type("System"),
                Token.Punctuation.Accessor,
                Token.Type("Collections"),
                Token.Punctuation.Accessor,
                Token.Type("Generic"),
                Token.Punctuation.Accessor,
                Token.Type("List"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("System"),
                Token.Punctuation.Accessor,
                Token.Type("Int32"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.Semicolon]);
        });

        it("type alias with nested generic types", () => {

            const input = `using X = System.Collections.Generic.Dictionary<System.Int32, System.Collections.Generic.List<System.String>>;`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Using,
                Token.Identifiers.AliasName("X"),
                Token.Operators.Assignment,
                Token.Type("System"),
                Token.Punctuation.Accessor,
                Token.Type("Collections"),
                Token.Punctuation.Accessor,
                Token.Type("Generic"),
                Token.Punctuation.Accessor,
                Token.Type("Dictionary"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("System"),
                Token.Punctuation.Accessor,
                Token.Type("Int32"),
                Token.Punctuation.Comma,
                Token.Type("System"),
                Token.Punctuation.Accessor,
                Token.Type("Collections"),
                Token.Punctuation.Accessor,
                Token.Type("Generic"),
                Token.Punctuation.Accessor,
                Token.Type("List"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("System"),
                Token.Punctuation.Accessor,
                Token.Type("String"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.Semicolon]);
        });
        
        it("type alias with nested generic types and comments interspersed", () => {

            const input = `using X =/**/Dictionary/**/</**/int/**/,/**/List/**/</**/string/**/>/**/>/**/;//end`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Using,
                Token.Identifiers.AliasName("X"),
                Token.Operators.Assignment,
                Token.Comment.MultiLine.Start,
                Token.Comment.MultiLine.End,
                Token.Type("Dictionary"),
                Token.Comment.MultiLine.Start,
                Token.Comment.MultiLine.End,
                Token.Punctuation.TypeParameters.Begin,
                Token.Comment.MultiLine.Start,
                Token.Comment.MultiLine.End,
                Token.PrimitiveType.Int,
                Token.Comment.MultiLine.Start,
                Token.Comment.MultiLine.End,
                Token.Punctuation.Comma,
                Token.Comment.MultiLine.Start,
                Token.Comment.MultiLine.End,
                Token.Type("List"),
                Token.Comment.MultiLine.Start,
                Token.Comment.MultiLine.End,
                Token.Punctuation.TypeParameters.Begin,
                Token.Comment.MultiLine.Start,
                Token.Comment.MultiLine.End,
                Token.PrimitiveType.String,
                Token.Comment.MultiLine.Start,
                Token.Comment.MultiLine.End,
                Token.Punctuation.TypeParameters.End,
                Token.Comment.MultiLine.Start,
                Token.Comment.MultiLine.End,
                Token.Punctuation.TypeParameters.End,
                Token.Comment.MultiLine.Start,
                Token.Comment.MultiLine.End,
                Token.Punctuation.Semicolon,
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("end")]);
        });
    });
});