import { should } from 'chai';
import { Tokens, Token } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe.skip("Literals - numeric", () => {
        it("decimal zero", () => {

            const input = `
class C {
    method M() {
        var x = 0;
    }
}`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Puncuation.SquareBracket.Open(2, 1));
            tokens.should.contain(Tokens.Type("Foo", 2, 2));
            tokens.should.contain(Tokens.Puncuation.SquareBracket.Close(2, 5));
        });
    });
});