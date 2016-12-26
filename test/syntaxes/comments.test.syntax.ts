import { should } from 'chai';
import { Tokens, Token } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe("Comments", () => {
        it("single-line comment", () => {

            const input = `
// foo`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Comment.SingleLine.Start(2, 1));
            tokens.should.contain(Tokens.Comment.SingleLine.Text(" foo", 2, 3));
        });

        it("single-line comment after whitespace", () => {

            const input = `
    // foo`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Comment.LeadingWhitespace("    ", 2, 1));
            tokens.should.contain(Tokens.Comment.SingleLine.Start(2, 5));
            tokens.should.contain(Tokens.Comment.SingleLine.Text(" foo", 2, 7));
        });

        it("multi-line comment", () => {

            const input = `
/* foo */`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Comment.MultiLine.Start(2, 1));
            tokens.should.contain(Tokens.Comment.MultiLine.Text(" foo ", 2, 3));
            tokens.should.contain(Tokens.Comment.MultiLine.End(2, 8));
        });
    });
});