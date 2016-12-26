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
            tokens.should.contain(Tokens.Identifiers.NamespaceName("System", 2, 7));
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
            tokens.should.contain(Tokens.Identifiers.AliasName("S", 2, 7));
            tokens.should.contain(Tokens.Operators.Assignment(2, 9));
            tokens.should.contain(Tokens.Type("System", 2, 11));
            tokens.should.contain(Tokens.Puncuation.Semicolon(2, 17));
        });

        it("type alias", () => {

            const input = `
using C = System.Console;`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Using(2, 1));
            tokens.should.contain(Tokens.Identifiers.AliasName("C", 2, 7));
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
            tokens.should.contain(Tokens.Identifiers.AliasName("IntList", 2, 7));
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
            tokens.should.contain(Tokens.Identifiers.AliasName("X", 2, 7));
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
using X =/**/Dictionary/**/</**/int/**/,/**/List/**/</**/string/**/>/**/>/**/;//end`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Using(2, 1));
            tokens.should.contain(Tokens.Identifiers.AliasName("X", 2, 7));
            tokens.should.contain(Tokens.Operators.Assignment(2, 9));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 10));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 12));
            tokens.should.contain(Tokens.Type("Dictionary", 2, 14));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 24));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 26));
            tokens.should.contain(Tokens.Puncuation.TypeParametersBegin(2, 28));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 29));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 31));
            tokens.should.contain(Tokens.Type("int", 2, 33));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 36));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 38));
            tokens.should.contain(Tokens.Puncuation.Comma(2, 40));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 41));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 43));
            tokens.should.contain(Tokens.Type("List", 2, 45));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 49));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 51));
            tokens.should.contain(Tokens.Puncuation.TypeParametersBegin(2, 53));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 54));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 56));
            tokens.should.contain(Tokens.Type("string", 2, 58));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 64));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 66));
            tokens.should.contain(Tokens.Puncuation.TypeParametersEnd(2, 68));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 69));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 71));
            tokens.should.contain(Tokens.Puncuation.TypeParametersEnd(2, 73));
            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 74));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 76));
            tokens.should.contain(Tokens.Puncuation.Semicolon(2, 78));
            tokens.should.contain(Tokens.Comment.SingleLine.Start(2, 79));
            tokens.should.contain(Tokens.Comment.SingleLine.Text("end", 2, 81));
        });
    });
});