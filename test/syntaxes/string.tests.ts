import { should } from 'chai';
import { Tokens, Token } from './utils/tokenizer';
import { TokenizerUtil } from'./utils/tokenizerUtil';

describe("Grammar", function() {
    before(function() {
        should();
    });

    describe("String interpolated", function() {
        it("non-verbatim", function() {

const input = `
public class Tester
{
    string test = $"hello {one} world {two}!";
}`;

            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StringStart('$"', 4, 19));
            tokens.should.contain(Tokens.StringDoubleQuoted("hello ", 4, 21));
            tokens.should.contain(Tokens.StringInterpolatedExpression("one", 4, 28));
            tokens.should.contain(Tokens.StringDoubleQuoted(" world ", 4, 32));
            tokens.should.contain(Tokens.StringInterpolatedExpression("two", 4, 40));
            tokens.should.contain(Tokens.StringDoubleQuoted("!", 4, 44));
            tokens.should.contain(Tokens.StringEnd('"', 4, 45));
        });


        it("non-verbatim without expressions single-line", function() {

const input = `
public class Tester
{
    string test = $"hello world!";
}`;

            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StringStart('$"', 4, 19));
            tokens.should.contain(Tokens.StringDoubleQuoted("hello world!", 4, 21));
            tokens.should.contain(Tokens.StringEnd('"', 4, 33));
        });

        it("non-verbatim multi-line", function() {

const input = `
public class Tester
{
    string test = $"hello
world!";
}`;

            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StringStart('$"', 4, 19));
            tokens.should.contain(Tokens.StringDoubleQuoted("hello", 4, 21));
            tokens.should.not.contain(Tokens.StringDoubleQuoted("world!", 5, 1));
            tokens.should.not.contain(Tokens.StringEnd('"', 5, 7));
        });


        it("verbatim single-line", function() {

const input = `
public class Tester
{
    string test = $@"hello {one} world {two}!";
}`;

            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StringStart('$@"', 4, 19));
            tokens.should.contain(Tokens.StringDoubleQuotedVerbatim("hello ", 4, 22));
            tokens.should.contain(Tokens.StringInterpolatedExpression("one", 4, 29));
            tokens.should.contain(Tokens.StringDoubleQuotedVerbatim(" world ", 4, 33));
            tokens.should.contain(Tokens.StringInterpolatedExpression("two", 4, 41));
            tokens.should.contain(Tokens.StringDoubleQuotedVerbatim("!", 4, 45));
            tokens.should.contain(Tokens.StringEnd('"', 4, 46));
        });


        it("verbatim multi-line", function() {

const input = `
public class Tester
{
    string test = $@"hello {one}
    world {two}!";
}`;

            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StringStart('$@"', 4, 19));
            tokens.should.contain(Tokens.StringDoubleQuotedVerbatim("hello ", 4, 22));
            tokens.should.contain(Tokens.StringInterpolatedExpression("one", 4, 29));
            tokens.should.contain(Tokens.StringDoubleQuotedVerbatim("    world ", 5, 1));
            tokens.should.contain(Tokens.StringInterpolatedExpression("two", 5, 12));
            tokens.should.contain(Tokens.StringDoubleQuotedVerbatim("!", 5, 16));
            tokens.should.contain(Tokens.StringEnd('"', 5, 17));
        });

        it("verbatim multi-line without expressions", function() {

const input = `
public class Tester
{
    string test = $@"hello
    world!";
}`;

            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StringStart('$@"', 4, 19));
            tokens.should.contain(Tokens.StringDoubleQuotedVerbatim("hello", 4, 22));
            tokens.should.contain(Tokens.StringDoubleQuotedVerbatim("    world!", 5, 1));
            tokens.should.contain(Tokens.StringEnd('"', 5, 11));
        });
    });
});


