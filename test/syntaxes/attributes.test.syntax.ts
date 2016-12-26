import { should } from 'chai';
import { Tokens, Token } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe("Attributes", () => {
        it("global attribute", () => {

            const input = `
[Foo]`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Puncuation.SquareBracket.Open(2, 1));
            tokens.should.contain(Tokens.Type("Foo", 2, 2));
            tokens.should.contain(Tokens.Puncuation.SquareBracket.Close(2, 5));
        });

        it("global attribute with specifier", () => {

            const input = `
[assembly: Foo]`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Puncuation.SquareBracket.Open(2, 1));
            tokens.should.contain(Tokens.Keywords.AttributeSpecifier("assembly", 2, 2));
            tokens.should.contain(Tokens.Puncuation.Colon(2, 10));
            tokens.should.contain(Tokens.Type("Foo", 2, 12));
            tokens.should.contain(Tokens.Puncuation.SquareBracket.Close(2, 15));
        });

        it("Two global attributes in same section with specifier", () => {

            const input = `
[module: Foo, Bar]`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Puncuation.SquareBracket.Open(2, 1));
            tokens.should.contain(Tokens.Keywords.AttributeSpecifier("module", 2, 2));
            tokens.should.contain(Tokens.Puncuation.Colon(2, 8));
            tokens.should.contain(Tokens.Type("Foo", 2, 10));
            tokens.should.contain(Tokens.Puncuation.Comma(2, 13));
            tokens.should.contain(Tokens.Type("Bar", 2, 15));
            tokens.should.contain(Tokens.Puncuation.SquareBracket.Close(2, 18));
        });

        it("Two global attributes in same section with specifier and empty argument lists", () => {

            const input = `
[module: Foo(), Bar()]`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Puncuation.SquareBracket.Open(2, 1));
            tokens.should.contain(Tokens.Keywords.AttributeSpecifier("module", 2, 2));
            tokens.should.contain(Tokens.Puncuation.Colon(2, 8));
            tokens.should.contain(Tokens.Type("Foo", 2, 10));
            tokens.should.contain(Tokens.Puncuation.Parenthesis.Open(2, 13));
            tokens.should.contain(Tokens.Puncuation.Parenthesis.Close(2, 14));
            tokens.should.contain(Tokens.Puncuation.Comma(2, 15));
            tokens.should.contain(Tokens.Type("Bar", 2, 17));
            tokens.should.contain(Tokens.Puncuation.Parenthesis.Open(2, 20));
            tokens.should.contain(Tokens.Puncuation.Parenthesis.Close(2, 21));
            tokens.should.contain(Tokens.Puncuation.SquareBracket.Close(2, 22));
        });

        it("Global attribute with one argument", () => {

            const input = `
[Foo(true)]`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Puncuation.SquareBracket.Open(2, 1));
            tokens.should.contain(Tokens.Type("Foo", 2, 2));
            tokens.should.contain(Tokens.Puncuation.Parenthesis.Open(2, 5));
            tokens.should.contain(Tokens.Literals.Boolean.True(2, 6));
            tokens.should.contain(Tokens.Puncuation.Parenthesis.Close(2, 10));
            tokens.should.contain(Tokens.Puncuation.SquareBracket.Close(2, 11));
        });

        it("Global attribute with two arguments", () => {

            const input = `
[Foo(true, 42)]`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Puncuation.SquareBracket.Open(2, 1));
            tokens.should.contain(Tokens.Type("Foo", 2, 2));
            tokens.should.contain(Tokens.Puncuation.Parenthesis.Open(2, 5));
            tokens.should.contain(Tokens.Literals.Boolean.True(2, 6));
            tokens.should.contain(Tokens.Puncuation.Comma(2, 10));
            tokens.should.contain(Tokens.Literals.Numeric.Decimal("42", 2, 12));
            tokens.should.contain(Tokens.Puncuation.Parenthesis.Close(2, 14));
            tokens.should.contain(Tokens.Puncuation.SquareBracket.Close(2, 15));
        });

        it("Global attribute with three arguments", () => {

            const input = `
[Foo(true, 42, "text")]`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Puncuation.SquareBracket.Open(2, 1));
            tokens.should.contain(Tokens.Type("Foo", 2, 2));
            tokens.should.contain(Tokens.Puncuation.Parenthesis.Open(2, 5));
            tokens.should.contain(Tokens.Literals.Boolean.True(2, 6));
            tokens.should.contain(Tokens.Puncuation.Comma(2, 10));
            tokens.should.contain(Tokens.Literals.Numeric.Decimal("42", 2, 12));
            tokens.should.contain(Tokens.Puncuation.Comma(2, 14));
            tokens.should.contain(Tokens.Puncuation.String.Begin(2, 16));
            tokens.should.contain(Tokens.Literals.String("text", 2, 17));
            tokens.should.contain(Tokens.Puncuation.String.End(2, 21));
            tokens.should.contain(Tokens.Puncuation.Parenthesis.Close(2, 22));
            tokens.should.contain(Tokens.Puncuation.SquareBracket.Close(2, 23));
        });
    });
});