/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { Tokens } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe("Using directives", () => {
        it("using namespace", () => {

            const input = `
using System;`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Using(2, 1),
                Tokens.Identifiers.NamespaceName("System", 2, 7),
                Tokens.Puncuation.Semicolon(2, 13)]);
        });

        it("using static type", () => {

            const input = `
using static System.Console;`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Using(2, 1),
                Tokens.Keywords.Static(2, 7),
                Tokens.Type("System", 2, 14),
                Tokens.Puncuation.Accessor(2, 20),
                Tokens.Type("Console", 2, 21),
                Tokens.Puncuation.Semicolon(2, 28)]);
        });

        it("namespace alias", () => {

            const input = `
using S = System;`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Using(2, 1),
                Tokens.Identifiers.AliasName("S", 2, 7),
                Tokens.Operators.Assignment(2, 9),
                Tokens.Type("System", 2, 11),
                Tokens.Puncuation.Semicolon(2, 17)]);
        });

        it("type alias", () => {

            const input = `
using C = System.Console;`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Using(2, 1),
                Tokens.Identifiers.AliasName("C", 2, 7),
                Tokens.Operators.Assignment(2, 9),
                Tokens.Type("System", 2, 11),
                Tokens.Puncuation.Accessor(2, 17),
                Tokens.Type("Console", 2, 18),
                Tokens.Puncuation.Semicolon(2, 25)]);
        });

        it("type alias with generic type", () => {

            const input = `
using IntList = System.Collections.Generic.List<System.Int32>;`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Using(2, 1),
                Tokens.Identifiers.AliasName("IntList", 2, 7),
                Tokens.Operators.Assignment(2, 15),
                Tokens.Type("System", 2, 17),
                Tokens.Puncuation.Accessor(2, 23),
                Tokens.Type("Collections", 2, 24),
                Tokens.Puncuation.Accessor(2, 35),
                Tokens.Type("Generic", 2, 36),
                Tokens.Puncuation.Accessor(2, 43),
                Tokens.Type("List", 2, 44),
                Tokens.Puncuation.TypeParameters.Begin(2, 48),
                Tokens.Type("System", 2, 49),
                Tokens.Puncuation.Accessor(2, 55),
                Tokens.Type("Int32", 2, 56),
                Tokens.Puncuation.TypeParameters.End(2, 61),
                Tokens.Puncuation.Semicolon(2, 62)]);
        });

        it("type alias with nested generic types", () => {

            const input = `
using X = System.Collections.Generic.Dictionary<System.Int32, System.Collections.Generic.List<System.String>>;`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Using(2, 1),
                Tokens.Identifiers.AliasName("X", 2, 7),
                Tokens.Operators.Assignment(2, 9),
                Tokens.Type("System", 2, 11),
                Tokens.Puncuation.Accessor(2, 17),
                Tokens.Type("Collections", 2, 18),
                Tokens.Puncuation.Accessor(2, 29),
                Tokens.Type("Generic", 2, 30),
                Tokens.Puncuation.Accessor(2, 37),
                Tokens.Type("Dictionary", 2, 38),
                Tokens.Puncuation.TypeParameters.Begin(2, 48),
                Tokens.Type("System", 2, 49),
                Tokens.Puncuation.Accessor(2, 55),
                Tokens.Type("Int32", 2, 56),
                Tokens.Puncuation.Comma(2, 61),
                Tokens.Type("System", 2, 63),
                Tokens.Puncuation.Accessor(2, 69),
                Tokens.Type("Collections", 2, 70),
                Tokens.Puncuation.Accessor(2, 81),
                Tokens.Type("Generic", 2, 82),
                Tokens.Puncuation.Accessor(2, 89),
                Tokens.Type("List", 2, 90),
                Tokens.Puncuation.TypeParameters.Begin(2, 94),
                Tokens.Type("System", 2, 95),
                Tokens.Puncuation.Accessor(2, 101),
                Tokens.Type("String", 2, 102),
                Tokens.Puncuation.TypeParameters.End(2, 108),
                Tokens.Puncuation.TypeParameters.End(2, 109),
                Tokens.Puncuation.Semicolon(2, 110)]);
        });
        
        it("type alias with nested generic types and comments interspersed", () => {

            const input = `
using X =/**/Dictionary/**/</**/int/**/,/**/List/**/</**/string/**/>/**/>/**/;//end`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Using(2, 1),
                Tokens.Identifiers.AliasName("X", 2, 7),
                Tokens.Operators.Assignment(2, 9),
                Tokens.Comment.MultiLine.Start(2, 10),
                Tokens.Comment.MultiLine.End(2, 12),
                Tokens.Type("Dictionary", 2, 14),
                Tokens.Comment.MultiLine.Start(2, 24),
                Tokens.Comment.MultiLine.End(2, 26),
                Tokens.Puncuation.TypeParameters.Begin(2, 28),
                Tokens.Comment.MultiLine.Start(2, 29),
                Tokens.Comment.MultiLine.End(2, 31),
                Tokens.Type("int", 2, 33),
                Tokens.Comment.MultiLine.Start(2, 36),
                Tokens.Comment.MultiLine.End(2, 38),
                Tokens.Puncuation.Comma(2, 40),
                Tokens.Comment.MultiLine.Start(2, 41),
                Tokens.Comment.MultiLine.End(2, 43),
                Tokens.Type("List", 2, 45),
                Tokens.Comment.MultiLine.Start(2, 49),
                Tokens.Comment.MultiLine.End(2, 51),
                Tokens.Puncuation.TypeParameters.Begin(2, 53),
                Tokens.Comment.MultiLine.Start(2, 54),
                Tokens.Comment.MultiLine.End(2, 56),
                Tokens.Type("string", 2, 58),
                Tokens.Comment.MultiLine.Start(2, 64),
                Tokens.Comment.MultiLine.End(2, 66),
                Tokens.Puncuation.TypeParameters.End(2, 68),
                Tokens.Comment.MultiLine.Start(2, 69),
                Tokens.Comment.MultiLine.End(2, 71),
                Tokens.Puncuation.TypeParameters.End(2, 73),
                Tokens.Comment.MultiLine.Start(2, 74),
                Tokens.Comment.MultiLine.End(2, 76),
                Tokens.Puncuation.Semicolon(2, 78),
                Tokens.Comment.SingleLine.Start(2, 79),
                Tokens.Comment.SingleLine.Text("end", 2, 81)]);
        });
    });
});