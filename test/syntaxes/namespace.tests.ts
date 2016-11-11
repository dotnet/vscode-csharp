import { should } from 'chai';
import { Tokens, Token } from './utils/tokenizer';
import { TokenizerUtil } from'./utils/tokenizerUtil';

describe("Grammar", function() {
    before(function () {
        should();
    });

    describe("Namespace", function() {
        it("has a namespace keyword and a name", function() {

const input = `
namespace TestNamespace
{
}`;
            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.NamespaceKeyword("namespace", 2, 1));
            tokens.should.contain(Tokens.NamespaceIdentifier("TestNamespace", 2, 11));
        });

        it("can be nested", function() {

const input = `
namespace TestNamespace
{
    namespace NestedNamespace {

    }
}`;
            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.NamespaceKeyword("namespace", 2, 1));
            tokens.should.contain(Tokens.NamespaceIdentifier("TestNamespace", 2, 11));

            tokens.should.contain(Tokens.NamespaceKeyword("namespace", 4, 5));
            tokens.should.contain(Tokens.NamespaceIdentifier("NestedNamespace", 4, 15));
        });

        it("can contain using statements", function() {

const input = `
using UsineOne;
using one = UsineOne.Something;

namespace TestNamespace
{
    using UsingTwo;
    using two = UsineOne.Something;

    namespace NestedNamespace
    {
        using UsingThree;
        using three = UsineOne.Something;
    }
}`;
            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.UsingKeyword("using", 2, 1));
            tokens.should.contain(Tokens.UsingKeyword("using", 3, 1));

            tokens.should.contain(Tokens.NamespaceKeyword("namespace", 5, 1));
            tokens.should.contain(Tokens.NamespaceIdentifier("TestNamespace", 5, 11));

            tokens.should.contain(Tokens.UsingKeyword("using", 7, 5));
            tokens.should.contain(Tokens.UsingKeyword("using", 8, 5));

            tokens.should.contain(Tokens.NamespaceKeyword("namespace", 10, 5));
            tokens.should.contain(Tokens.NamespaceIdentifier("NestedNamespace", 10, 15));

            tokens.should.contain(Tokens.UsingKeyword("using", 12, 9));
            tokens.should.contain(Tokens.UsingKeyword("using", 12, 9));
        });
    });
});


