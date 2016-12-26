import { should } from 'chai';
import { Tokens, Token } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe("Extern aliases", () => {
        it("simple", () => {

            const input = `
extern alias X;
extern alias Y;`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Extern(2, 1));
            tokens.should.contain(Tokens.Keywords.Alias(2, 8));
            tokens.should.contain(Tokens.Variables.Alias("X", 2, 14));
            tokens.should.contain(Tokens.Puncuation.Semicolon(2, 15));
            tokens.should.contain(Tokens.Keywords.Extern(3, 1));
            tokens.should.contain(Tokens.Keywords.Alias(3, 8));
            tokens.should.contain(Tokens.Variables.Alias("Y", 3, 14));
            tokens.should.contain(Tokens.Puncuation.Semicolon(3, 15));
        });
    });
});