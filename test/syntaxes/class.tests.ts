import { should } from 'chai';
import { Tokens, Token } from './utils/tokenizer';
import { TokenizerUtil } from'./utils/tokenizerUtil';

describe("Grammar", function() {
    before(function() {
        should();
    });

    describe("Class", function() {
        it("class keyword and storage modifiers", function() {

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

        it("generics in identifier", function () {

            const input = `
namespace TestNamespace
{
    class Dictionary<T, Dictionary<string, string>> { }
}`;
            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.ClassKeyword("class", 4, 5));
            tokens.should.contain(Tokens.ClassIdentifier("Dictionary<T, Dictionary<string, string>>", 4, 11));
        });

        it("inheritance", function() {

const input = `
namespace TestNamespace
{
    class PublicClass    : IInterface,    IInterfaceTwo { }
    class PublicClass<T> : Root.IInterface<Something.Nested>, Something.IInterfaceTwo { }
    class PublicClass<T> : Dictionary<T, Dictionary<string, string>>, IMap<T, Dictionary<string, string>> { }
}`;
            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.ClassKeyword("class", 4, 5));
            tokens.should.contain(Tokens.ClassIdentifier("PublicClass", 4, 11));
            tokens.should.contain(Tokens.Type("IInterface", 4, 28));
            tokens.should.contain(Tokens.Type("IInterfaceTwo", 4, 43));

            tokens.should.contain(Tokens.ClassKeyword("class", 5, 5));
            tokens.should.contain(Tokens.ClassIdentifier("PublicClass<T>", 5, 11));
            tokens.should.contain(Tokens.Type("Root.IInterface<Something.Nested>", 5, 28));
            tokens.should.contain(Tokens.Type("Something.IInterfaceTwo", 5, 63));

            tokens.should.contain(Tokens.Type("Dictionary<T, Dictionary<string, string>>", 6, 28));
            tokens.should.contain(Tokens.Type("IMap<T, Dictionary<string, string>>", 6, 71));
        });

        it("generic constraints", function() {

const input = `
namespace TestNamespace
{
    class PublicClass<T> where T : ISomething { }
    class PublicClass<T, X> : Dictionary<T, List<string>[]>, ISomething where T : ICar, new() where X : struct { }
}`;
            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.ClassKeyword("class", 4, 5));
            tokens.should.contain(Tokens.ClassIdentifier("PublicClass<T>", 4, 11));
            tokens.should.contain(Tokens.Keyword("where", 4, 26));
            tokens.should.contain(Tokens.Type("T", 4, 32));
            tokens.should.contain(Tokens.Type("ISomething", 4, 36));

            tokens.should.contain(Tokens.ClassKeyword("class", 5, 5));
            tokens.should.contain(Tokens.ClassIdentifier("PublicClass<T, X>", 5, 11));
            tokens.should.contain(Tokens.Type("Dictionary<T, List<string>[]>", 5, 31));
            tokens.should.contain(Tokens.Type("ISomething", 5, 62));
            tokens.should.contain(Tokens.Keyword("where", 5, 73));
            tokens.should.contain(Tokens.Type("T", 5, 79));
            tokens.should.contain(Tokens.Type("ICar", 5, 83));
            tokens.should.contain(Tokens.Keyword("new", 5, 89));
            tokens.should.contain(Tokens.Keyword("where", 5, 95));
            tokens.should.contain(Tokens.Type("X", 5, 101));
            tokens.should.contain(Tokens.Keyword("struct", 5, 105));

        });

        it("nested class", function() {

const input = `
namespace TestNamespace
{
    class Klass
    {
        public class Nested
        {

        }
    }
}`;
            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.ClassKeyword("class", 4, 5));
            tokens.should.contain(Tokens.ClassIdentifier("Klass", 4, 11));

            tokens.should.contain(Tokens.StorageModifierKeyword("public", 6, 9));
            tokens.should.contain(Tokens.ClassKeyword("class", 6, 16));
            tokens.should.contain(Tokens.ClassIdentifier("Nested", 6, 22));
        });
    });
});


