import { should } from 'chai';
import { Tokens, Token } from './utils/tokenizer';
import { TokenizerUtil } from'./utils/tokenizerUtil';

describe("Grammar", function() {
    before(function() {
        should();
    });

    describe("Class", function() {
        it("has a class keyword, a name and optional storage modifiers", function() {

const input = `
namespace TestNamespace
{
    public             class PublicClass { }

                       class DefaultClass { }

    internal           class InternalClass { }

              static   class DefaultStaticClass { }

    public    static   class PublicStaticClass { }

              sealed   class DefaultSealedClass { }

    public    sealed   class PublicSealedClass { }

    public    abstract class PublicAbstractClass { }

              abstract class DefaultAbstractClass { }
}`;
            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("public", 4, 5));
            tokens.should.contain(Tokens.ClassKeyword("class", 4, 24));
            tokens.should.contain(Tokens.ClassIdentifier("PublicClass", 4, 30));

            tokens.should.contain(Tokens.ClassKeyword("class", 6, 24));
            tokens.should.contain(Tokens.ClassIdentifier("DefaultClass", 6, 30));

            tokens.should.contain(Tokens.StorageModifierKeyword("internal", 8, 5));
            tokens.should.contain(Tokens.ClassKeyword("class", 8, 24));
            tokens.should.contain(Tokens.ClassIdentifier("InternalClass", 8, 30));

            tokens.should.contain(Tokens.StorageModifierKeyword("static", 10, 15));
            tokens.should.contain(Tokens.ClassKeyword("class", 10, 24));
            tokens.should.contain(Tokens.ClassIdentifier("DefaultStaticClass", 10, 30));

            tokens.should.contain(Tokens.StorageModifierKeyword("public", 12, 5));
            tokens.should.contain(Tokens.StorageModifierKeyword("static", 12, 15));
            tokens.should.contain(Tokens.ClassKeyword("class", 12, 24));
            tokens.should.contain(Tokens.ClassIdentifier("PublicStaticClass", 12, 30));

            tokens.should.contain(Tokens.StorageModifierKeyword("sealed", 14, 15));
            tokens.should.contain(Tokens.ClassKeyword("class", 14, 24));
            tokens.should.contain(Tokens.ClassIdentifier("DefaultSealedClass", 14, 30));

            tokens.should.contain(Tokens.StorageModifierKeyword("public", 16, 5));
            tokens.should.contain(Tokens.StorageModifierKeyword("sealed", 16, 15));
            tokens.should.contain(Tokens.ClassKeyword("class", 16, 24));
            tokens.should.contain(Tokens.ClassIdentifier("PublicSealedClass", 16, 30));

            tokens.should.contain(Tokens.StorageModifierKeyword("public", 18, 5));
            tokens.should.contain(Tokens.StorageModifierKeyword("abstract", 18, 15));
            tokens.should.contain(Tokens.ClassKeyword("class", 18, 24));
            tokens.should.contain(Tokens.ClassIdentifier("PublicAbstractClass", 18, 30));

            tokens.should.contain(Tokens.StorageModifierKeyword("abstract", 20, 15));
            tokens.should.contain(Tokens.ClassKeyword("class", 20, 24));
            tokens.should.contain(Tokens.ClassIdentifier("DefaultAbstractClass", 20, 30));

        });

    });
});


