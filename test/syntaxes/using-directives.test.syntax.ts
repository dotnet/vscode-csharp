import { should } from 'chai';
import { Tokens, Token } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe("Using directives", () => {
        it("using namespace", () => {

            const input = `
using System;`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Using(2, 1));
            tokens.should.contain(Tokens.Type("System", 2, 7));
            tokens.should.contain(Tokens.Puncuation.Semicolon(2, 13));
        });

        it("using static type", () => {

            const input = `
using static System.Console;`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Using(2, 1));
            tokens.should.contain(Tokens.Keywords.Static(2, 7));
            tokens.should.contain(Tokens.Type("System", 2, 14));
            tokens.should.contain(Tokens.Puncuation.Accessor(2, 20));
            tokens.should.contain(Tokens.Type("Console", 2, 21));
            tokens.should.contain(Tokens.Puncuation.Semicolon(2, 28));
        });

        it("namespace alias", () => {

            const input = `
using S = System;`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Using(2, 1));
            tokens.should.contain(Tokens.Type("S", 2, 7));
            tokens.should.contain(Tokens.Operators.Assignment(2, 9));
            tokens.should.contain(Tokens.Type("System", 2, 11));
            tokens.should.contain(Tokens.Puncuation.Semicolon(2, 17));
        });

        it("type alias", () => {

            const input = `
using C = System.Console;`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Using(2, 1));
            tokens.should.contain(Tokens.Type("C", 2, 7));
            tokens.should.contain(Tokens.Operators.Assignment(2, 9));
            tokens.should.contain(Tokens.Type("System", 2, 11));
            tokens.should.contain(Tokens.Puncuation.Accessor(2, 17));
            tokens.should.contain(Tokens.Type("Console", 2, 18));
            tokens.should.contain(Tokens.Puncuation.Semicolon(2, 25));
        });

        it("type alias with generic type", () => {

            const input = `
using IntList = System.Collections.Generic.List<System.Int32>;`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Using(2, 1));
            tokens.should.contain(Tokens.Type("IntList", 2, 7));
            tokens.should.contain(Tokens.Operators.Assignment(2, 15));
            tokens.should.contain(Tokens.Type("System", 2, 17));
            tokens.should.contain(Tokens.Puncuation.Accessor(2, 23));
            tokens.should.contain(Tokens.Type("Collections", 2, 24));
            tokens.should.contain(Tokens.Puncuation.Accessor(2, 35));
            tokens.should.contain(Tokens.Type("Generic", 2, 36));
            tokens.should.contain(Tokens.Puncuation.Accessor(2, 43));
            tokens.should.contain(Tokens.Type("List", 2, 44));
            tokens.should.contain(Tokens.Puncuation.TypeParametersBegin(2, 48));
            tokens.should.contain(Tokens.Type("System", 2, 49));
            tokens.should.contain(Tokens.Puncuation.Accessor(2, 55));
            tokens.should.contain(Tokens.Type("Int32", 2, 56));
            tokens.should.contain(Tokens.Puncuation.TypeParametersEnd(2, 61));
            tokens.should.contain(Tokens.Puncuation.Semicolon(2, 62));
        });

        it("type alias with nested generic types", () => {

            const input = `
using X = System.Collections.Generic.Dictionary<System.Int32, System.Collections.Generic.List<System.String>>;`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Using(2, 1));
            tokens.should.contain(Tokens.Type("X", 2, 7));
            tokens.should.contain(Tokens.Operators.Assignment(2, 9));
            tokens.should.contain(Tokens.Type("System", 2, 11));
            tokens.should.contain(Tokens.Puncuation.Accessor(2, 17));
            tokens.should.contain(Tokens.Type("Collections", 2, 18));
            tokens.should.contain(Tokens.Puncuation.Accessor(2, 29));
            tokens.should.contain(Tokens.Type("Generic", 2, 30));
            tokens.should.contain(Tokens.Puncuation.Accessor(2, 37));
            tokens.should.contain(Tokens.Type("Dictionary", 2, 38));
            tokens.should.contain(Tokens.Puncuation.TypeParametersBegin(2, 48));
            tokens.should.contain(Tokens.Type("System", 2, 49));
            tokens.should.contain(Tokens.Puncuation.Accessor(2, 55));
            tokens.should.contain(Tokens.Type("Int32", 2, 56));
            tokens.should.contain(Tokens.Puncuation.Comma(2, 61));
            tokens.should.contain(Tokens.Type("System", 2, 63));
            tokens.should.contain(Tokens.Puncuation.Accessor(2, 69));
            tokens.should.contain(Tokens.Type("Collections", 2, 70));
            tokens.should.contain(Tokens.Puncuation.Accessor(2, 81));
            tokens.should.contain(Tokens.Type("Generic", 2, 82));
            tokens.should.contain(Tokens.Puncuation.Accessor(2, 89));
            tokens.should.contain(Tokens.Type("List", 2, 90));
            tokens.should.contain(Tokens.Puncuation.TypeParametersBegin(2, 94));
            tokens.should.contain(Tokens.Type("System", 2, 95));
            tokens.should.contain(Tokens.Puncuation.Accessor(2, 101));
            tokens.should.contain(Tokens.Type("String", 2, 102));
            tokens.should.contain(Tokens.Puncuation.TypeParametersEnd(2, 108));
            tokens.should.contain(Tokens.Puncuation.TypeParametersEnd(2, 109));
            tokens.should.contain(Tokens.Puncuation.Semicolon(2, 110));
        });
        
        it("type alias with nested generic types and comments interspersed", () => {

            const input = `
using/**/X/**/=/**/Dictionary/**/</**/int/**/,/**/List/**/</**/string/**/>/**/>/**/;//end`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Using(2, 1));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 6));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 8));
            tokens.should.contain(Tokens.Type("X", 2, 10));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 11));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 13));
            tokens.should.contain(Tokens.Operators.Assignment(2, 15));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 16));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 18));
            tokens.should.contain(Tokens.Type("Dictionary", 2, 20));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 30));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 32));
            tokens.should.contain(Tokens.Puncuation.TypeParametersBegin(2, 34));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 35));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 37));
            tokens.should.contain(Tokens.Type("int", 2, 39));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 42));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 44));
            tokens.should.contain(Tokens.Puncuation.Comma(2, 46));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 47));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 49));
            tokens.should.contain(Tokens.Type("List", 2, 51));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 55));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 57));
            tokens.should.contain(Tokens.Puncuation.TypeParametersBegin(2, 59));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 60));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 62));
            tokens.should.contain(Tokens.Type("string", 2, 64));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 70));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 72));
            tokens.should.contain(Tokens.Puncuation.TypeParametersEnd(2, 74));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 75));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 77));
            tokens.should.contain(Tokens.Puncuation.TypeParametersEnd(2, 79));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 80));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 82));
            tokens.should.contain(Tokens.Puncuation.Semicolon(2, 84));
            tokens.should.contain(Tokens.Comment.SingleLine.Start(2, 85));
            tokens.should.contain(Tokens.Comment.SingleLine.Text("end", 2, 87));
        });
    });
});