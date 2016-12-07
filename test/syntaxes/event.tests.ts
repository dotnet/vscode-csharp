import { should } from 'chai';
import { Tokens, Token } from './utils/tokenizer';
import { TokenizerUtil } from'./utils/tokenizerUtil';

describe("Grammar", function() {
    before(function() {
        should();
    });

    describe("Event", function() {
        it("declaration", function() {

const input = `
public class Tester
{
    public event Type Event;
}`;

            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("public", 4, 5));
            tokens.should.contain(Tokens.StorageModifierKeyword("event", 4, 12));
            tokens.should.contain(Tokens.Type("Type", 4, 18));
            tokens.should.contain(Tokens.EventIdentifier("Event", 4, 23));
        });

        it("generic", function () {

            const input = `
public class Tester
{
    public event EventHandler<List<T>, Dictionary<T, D>> Event;
}`;

            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("public", 4, 5));
            tokens.should.contain(Tokens.StorageModifierKeyword("event", 4, 12));
            tokens.should.contain(Tokens.Type("EventHandler<List<T>, Dictionary<T, D>>", 4, 18));
            tokens.should.contain(Tokens.EventIdentifier("Event", 4, 58));
        });
    });
});


