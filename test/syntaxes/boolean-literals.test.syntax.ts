import { should } from 'chai';
import { Tokens, Token } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe.skip("Literals - boolean", () => {
        it("true", () => {

            const input = `
class C {
    method M() {
        var x = true;
    }
}`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Literals.Boolean.True(4, 17));
        });

        it("false", () => {

            const input = `
class C {
    method M() {
        var x = false;
    }
}`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Literals.Boolean.False(4, 17));
        });
    });
});