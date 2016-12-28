/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Using directives", () => {
        it("using namespace", () => {

            const input = `using System;`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Using,
                Tokens.Identifiers.NamespaceName("System"),
                Tokens.Puncuation.Semicolon]);
        });

        it("using static type", () => {

            const input = `using static System.Console;`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Using,
                Tokens.Keywords.Static,
                Tokens.Type("System"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("Console"),
                Tokens.Puncuation.Semicolon]);
        });

        it("namespace alias", () => {

            const input = `using S = System;`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Using,
                Tokens.Identifiers.AliasName("S"),
                Tokens.Operators.Assignment,
                Tokens.Type("System"),
                Tokens.Puncuation.Semicolon]);
        });

        it("type alias", () => {

            const input = `using C = System.Console;`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Using,
                Tokens.Identifiers.AliasName("C"),
                Tokens.Operators.Assignment,
                Tokens.Type("System"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("Console"),
                Tokens.Puncuation.Semicolon]);
        });

        it("type alias with generic type", () => {

            const input = `using IntList = System.Collections.Generic.List<System.Int32>;`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Using,
                Tokens.Identifiers.AliasName("IntList"),
                Tokens.Operators.Assignment,
                Tokens.Type("System"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("Collections"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("Generic"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("List"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("System"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("Int32"),
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.Semicolon]);
        });

        it("type alias with nested generic types", () => {

            const input = `using X = System.Collections.Generic.Dictionary<System.Int32, System.Collections.Generic.List<System.String>>;`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Using,
                Tokens.Identifiers.AliasName("X"),
                Tokens.Operators.Assignment,
                Tokens.Type("System"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("Collections"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("Generic"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("Dictionary"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("System"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("Int32"),
                Tokens.Puncuation.Comma,
                Tokens.Type("System"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("Collections"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("Generic"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("List"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("System"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("String"),
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.Semicolon]);
        });
        
        it("type alias with nested generic types and comments interspersed", () => {

            const input = `using X =/**/Dictionary/**/</**/int/**/,/**/List/**/</**/string/**/>/**/>/**/;//end`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Using,
                Tokens.Identifiers.AliasName("X"),
                Tokens.Operators.Assignment,
                Tokens.Comment.MultiLine.Start,
                Tokens.Comment.MultiLine.End,
                Tokens.Type("Dictionary"),
                Tokens.Comment.MultiLine.Start,
                Tokens.Comment.MultiLine.End,
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Comment.MultiLine.Start,
                Tokens.Comment.MultiLine.End,
                Tokens.Type("int"),
                Tokens.Comment.MultiLine.Start,
                Tokens.Comment.MultiLine.End,
                Tokens.Puncuation.Comma,
                Tokens.Comment.MultiLine.Start,
                Tokens.Comment.MultiLine.End,
                Tokens.Type("List"),
                Tokens.Comment.MultiLine.Start,
                Tokens.Comment.MultiLine.End,
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Comment.MultiLine.Start,
                Tokens.Comment.MultiLine.End,
                Tokens.Type("string"),
                Tokens.Comment.MultiLine.Start,
                Tokens.Comment.MultiLine.End,
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Comment.MultiLine.Start,
                Tokens.Comment.MultiLine.End,
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Comment.MultiLine.Start,
                Tokens.Comment.MultiLine.End,
                Tokens.Puncuation.Semicolon,
                Tokens.Comment.SingleLine.Start,
                Tokens.Comment.SingleLine.Text("end")]);
        });
    });
});