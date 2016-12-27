import { should } from 'chai';
import { Tokens, Token } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => {
        should();
    });

    describe("Namespace", () => {
        it("has a namespace keyword and a name", () => {

            const input = `
namespace TestNamespace
{
}`;
            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Namespace(2, 1));
            tokens.should.contain(Tokens.Identifiers.NamespaceName("TestNamespace", 2, 11));
        });

        it("has a namespace keyword and a dotted name", () => {

            const input = `
namespace Test.Namespace
{
}`;
            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Namespace(2, 1));
            tokens.should.contain(Tokens.Identifiers.NamespaceName("Test", 2, 11));
            tokens.should.contain(Tokens.Puncuation.Accessor(2, 15));
            tokens.should.contain(Tokens.Identifiers.NamespaceName("Namespace", 2, 16));
        });

        it("can be nested", () => {

            const input = `
namespace TestNamespace
{
    namespace NestedNamespace {

    }
}`;
            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Namespace(2, 1));
            tokens.should.contain(Tokens.Identifiers.NamespaceName("TestNamespace", 2, 11));

            tokens.should.contain(Tokens.Keywords.Namespace(4, 5));
            tokens.should.contain(Tokens.Identifiers.NamespaceName("NestedNamespace", 4, 15));
        });

        it("can contain using statements", () => {

            const input = `
using UsingOne;
using one = UsingOne.Something;

namespace TestNamespace
{
    using UsingTwo;
    using two = UsingTwo.Something;

    namespace NestedNamespace
    {
        using UsingThree;
        using three = UsingThree.Something;
    }
}`;
            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Using(2, 1));
            tokens.should.contain(Tokens.Identifiers.NamespaceName("UsingOne", 2, 7));
            tokens.should.contain(Tokens.Puncuation.Semicolon(2, 15));

            tokens.should.contain(Tokens.Keywords.Using(3, 1));
            tokens.should.contain(Tokens.Identifiers.AliasName("one", 3, 7));
            tokens.should.contain(Tokens.Operators.Assignment(3, 11));
            tokens.should.contain(Tokens.Type("UsingOne", 3, 13));
            tokens.should.contain(Tokens.Puncuation.Accessor(3, 21));
            tokens.should.contain(Tokens.Type("Something", 3, 22));
            tokens.should.contain(Tokens.Puncuation.Semicolon(3, 31));

            tokens.should.contain(Tokens.Keywords.Namespace(5, 1));
            tokens.should.contain(Tokens.Identifiers.NamespaceName("TestNamespace", 5, 11));

            tokens.should.contain(Tokens.Keywords.Using(7, 5));
            tokens.should.contain(Tokens.Identifiers.NamespaceName("UsingTwo", 7, 11));
            tokens.should.contain(Tokens.Puncuation.Semicolon(7, 19));

            tokens.should.contain(Tokens.Keywords.Using(8, 5));
            tokens.should.contain(Tokens.Identifiers.AliasName("two", 8, 11));
            tokens.should.contain(Tokens.Operators.Assignment(8, 15));
            tokens.should.contain(Tokens.Type("UsingTwo", 8, 17));
            tokens.should.contain(Tokens.Puncuation.Accessor(8, 25));
            tokens.should.contain(Tokens.Type("Something", 8, 26));
            tokens.should.contain(Tokens.Puncuation.Semicolon(8, 35));

            tokens.should.contain(Tokens.Keywords.Namespace(10, 5));
            tokens.should.contain(Tokens.Identifiers.NamespaceName("NestedNamespace", 10, 15));

            tokens.should.contain(Tokens.Keywords.Using(12, 9));
            tokens.should.contain(Tokens.Identifiers.NamespaceName("UsingThree", 12, 15));
            tokens.should.contain(Tokens.Puncuation.Semicolon(12, 25));

            tokens.should.contain(Tokens.Keywords.Using(13, 9));
            tokens.should.contain(Tokens.Identifiers.AliasName("three", 13, 15));
            tokens.should.contain(Tokens.Operators.Assignment(13, 21));
            tokens.should.contain(Tokens.Type("UsingThree", 13, 23));
            tokens.should.contain(Tokens.Puncuation.Accessor(13, 33));
            tokens.should.contain(Tokens.Type("Something", 13, 34));
            tokens.should.contain(Tokens.Puncuation.Semicolon(13, 43));

        });
    });
});


