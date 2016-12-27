import { should } from 'chai';
import { Tokens, Token } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => {
        should();
    });

    describe("Class", () => {
        it("class keyword and storage modifiers", () => {

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
            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Modifiers.Public(4, 5));
            tokens.should.contain(Tokens.Keywords.Class(4, 24));
            tokens.should.contain(Tokens.Identifiers.ClassName("PublicClass", 4, 30));

            tokens.should.contain(Tokens.Keywords.Class(6, 24));
            tokens.should.contain(Tokens.Identifiers.ClassName("DefaultClass", 6, 30));

            tokens.should.contain(Tokens.Keywords.Modifiers.Internal(8, 5));
            tokens.should.contain(Tokens.Keywords.Class(8, 24));
            tokens.should.contain(Tokens.Identifiers.ClassName("InternalClass", 8, 30));

            tokens.should.contain(Tokens.Keywords.Modifiers.Static(10, 15));
            tokens.should.contain(Tokens.Keywords.Class(10, 24));
            tokens.should.contain(Tokens.Identifiers.ClassName("DefaultStaticClass", 10, 30));

            tokens.should.contain(Tokens.Keywords.Modifiers.Public(12, 5));
            tokens.should.contain(Tokens.Keywords.Modifiers.Static(12, 15));
            tokens.should.contain(Tokens.Keywords.Class(12, 24));
            tokens.should.contain(Tokens.Identifiers.ClassName("PublicStaticClass", 12, 30));

            tokens.should.contain(Tokens.Keywords.Modifiers.Sealed(14, 15));
            tokens.should.contain(Tokens.Keywords.Class(14, 24));
            tokens.should.contain(Tokens.Identifiers.ClassName("DefaultSealedClass", 14, 30));

            tokens.should.contain(Tokens.Keywords.Modifiers.Public(16, 5));
            tokens.should.contain(Tokens.Keywords.Modifiers.Sealed(16, 15));
            tokens.should.contain(Tokens.Keywords.Class(16, 24));
            tokens.should.contain(Tokens.Identifiers.ClassName("PublicSealedClass", 16, 30));

            tokens.should.contain(Tokens.Keywords.Modifiers.Public(18, 5));
            tokens.should.contain(Tokens.Keywords.Modifiers.Abstract(18, 15));
            tokens.should.contain(Tokens.Keywords.Class(18, 24));
            tokens.should.contain(Tokens.Identifiers.ClassName("PublicAbstractClass", 18, 30));

            tokens.should.contain(Tokens.Keywords.Modifiers.Abstract(20, 15));
            tokens.should.contain(Tokens.Keywords.Class(20, 24));
            tokens.should.contain(Tokens.Identifiers.ClassName("DefaultAbstractClass", 20, 30));

        });

        it("generics in identifier", () => {

            const input = `
namespace TestNamespace
{
    class Dictionary<TKey, TValue> { }
}`;
            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Class(4, 5));
            tokens.should.contain(Tokens.Identifiers.ClassName("Dictionary<TKey, TValue>", 4, 11));
        });

        it("inheritance", () => {

            const input = `
namespace TestNamespace
{
    class PublicClass    : IInterface,    IInterfaceTwo { }
    class PublicClass<T> : Root.IInterface<Something.Nested>, Something.IInterfaceTwo { }
    class PublicClass<T> : Dictionary<T, Dictionary<string, string>>, IMap<T, Dictionary<string, string>> { }
}`;
            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Class(4, 5));
            tokens.should.contain(Tokens.Identifiers.ClassName("PublicClass", 4, 11));
            tokens.should.contain(Tokens.Type("IInterface", 4, 28));
            tokens.should.contain(Tokens.Type("IInterfaceTwo", 4, 43));

            tokens.should.contain(Tokens.Keywords.Class(5, 5));
            tokens.should.contain(Tokens.Identifiers.ClassName("PublicClass<T>", 5, 11));
            tokens.should.contain(Tokens.Type("Root", 5, 28));
            tokens.should.contain(Tokens.Puncuation.Accessor(5, 32));
            tokens.should.contain(Tokens.Type("IInterface", 5, 33));
            tokens.should.contain(Tokens.Puncuation.TypeParametersBegin(5, 43));
            tokens.should.contain(Tokens.Type("Something", 5, 44));
            tokens.should.contain(Tokens.Puncuation.Accessor(5, 53));
            tokens.should.contain(Tokens.Type("Nested", 5, 54));
            tokens.should.contain(Tokens.Puncuation.TypeParametersEnd(5, 60));
            tokens.should.contain(Tokens.Puncuation.Comma(5, 61));
            tokens.should.contain(Tokens.Type("Something", 5, 63));
            tokens.should.contain(Tokens.Puncuation.Accessor(5, 72));
            tokens.should.contain(Tokens.Type("IInterfaceTwo", 5, 73));

            tokens.should.contain(Tokens.Type("Dictionary", 6, 28));
            tokens.should.contain(Tokens.Puncuation.TypeParametersBegin(6, 38));
            tokens.should.contain(Tokens.Type("T", 6, 39))
            tokens.should.contain(Tokens.Puncuation.Comma(6, 40));
            tokens.should.contain(Tokens.Type("Dictionary", 6, 42));
            tokens.should.contain(Tokens.Puncuation.TypeParametersBegin(6, 52));
            tokens.should.contain(Tokens.Type("string", 6, 53));
            tokens.should.contain(Tokens.Puncuation.Comma(6, 59));
            tokens.should.contain(Tokens.Type("string", 6, 61));
            tokens.should.contain(Tokens.Puncuation.TypeParametersEnd(6, 67));
            tokens.should.contain(Tokens.Puncuation.TypeParametersEnd(6, 68));
            tokens.should.contain(Tokens.Puncuation.Comma(6, 69));
            tokens.should.contain(Tokens.Type("IMap", 6, 71));
            tokens.should.contain(Tokens.Puncuation.TypeParametersBegin(6, 75));
            tokens.should.contain(Tokens.Type("T", 6, 76))
            tokens.should.contain(Tokens.Puncuation.Comma(6, 77));
            tokens.should.contain(Tokens.Type("Dictionary", 6, 79));
            tokens.should.contain(Tokens.Puncuation.TypeParametersBegin(6, 89));
            tokens.should.contain(Tokens.Type("string", 6, 90));
            tokens.should.contain(Tokens.Puncuation.Comma(6, 96));
            tokens.should.contain(Tokens.Type("string", 6, 98));
            tokens.should.contain(Tokens.Puncuation.TypeParametersEnd(6, 104));
            tokens.should.contain(Tokens.Puncuation.TypeParametersEnd(6, 105));
        });

        it("generic constraints", () => {

            const input = `
namespace TestNamespace
{
    class PublicClass<T> where T : ISomething { }
    class PublicClass<T, X> : Dictionary<T, List<string>[]>, ISomething
        where T : ICar, new()
        where X : struct
    {
    }
}`;
            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            for (let t of tokens) {
                console.log(t);
            }

            tokens.should.contain(Tokens.Keywords.Class(4, 5));
            tokens.should.contain(Tokens.Identifiers.ClassName("PublicClass<T>", 4, 11));
            tokens.should.contain(Tokens.Keywords.Where(4, 26));
            tokens.should.contain(Tokens.Type("T", 4, 32));
            tokens.should.contain(Tokens.Puncuation.Colon(4, 34));
            tokens.should.contain(Tokens.Type("ISomething", 4, 36));

            tokens.should.contain(Tokens.Keywords.Class(5, 5));
            tokens.should.contain(Tokens.Identifiers.ClassName("PublicClass<T, X>", 5, 11));
            tokens.should.contain(Tokens.Type("Dictionary", 5, 31));
            tokens.should.contain(Tokens.Puncuation.TypeParametersBegin(5, 41));
            tokens.should.contain(Tokens.Type("T", 5, 42));
            tokens.should.contain(Tokens.Puncuation.Comma(5, 43));
            tokens.should.contain(Tokens.Type("List", 5, 45));
            tokens.should.contain(Tokens.Puncuation.TypeParametersBegin(5, 49));
            tokens.should.contain(Tokens.Type("string", 5, 50));
            tokens.should.contain(Tokens.Puncuation.TypeParametersEnd(5, 56));
            tokens.should.contain(Tokens.Puncuation.SquareBracket.Open(5, 57));
            tokens.should.contain(Tokens.Puncuation.SquareBracket.Close(5, 58));
            tokens.should.contain(Tokens.Puncuation.TypeParametersEnd(5, 59));
            tokens.should.contain(Tokens.Puncuation.Comma(5, 60));
            tokens.should.contain(Tokens.Type("ISomething", 5, 62));
            tokens.should.contain(Tokens.Keywords.Where(6, 9));
            tokens.should.contain(Tokens.Type("T", 6, 15));
            tokens.should.contain(Tokens.Puncuation.Colon(6, 17));
            tokens.should.contain(Tokens.Type("ICar", 6, 19));
            tokens.should.contain(Tokens.Puncuation.Comma(6, 23));
            tokens.should.contain(Tokens.Keywords.New(6, 25));
            tokens.should.contain(Tokens.Puncuation.Parenthesis.Open(6, 28));
            tokens.should.contain(Tokens.Puncuation.Parenthesis.Close(6, 29));
            tokens.should.contain(Tokens.Keywords.Where(7, 9));
            tokens.should.contain(Tokens.Type("X", 7, 15));
            tokens.should.contain(Tokens.Puncuation.Colon(7, 17));
            tokens.should.contain(Tokens.Keywords.Struct(7, 19));
            tokens.should.contain(Tokens.Puncuation.CurlyBrace.Open(8, 5));
            tokens.should.contain(Tokens.Puncuation.CurlyBrace.Close(9, 5));
        });

        it("nested class", () => {

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
            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Class(4, 5));
            tokens.should.contain(Tokens.Identifiers.ClassName("Klass", 4, 11));

            tokens.should.contain(Tokens.Keywords.Modifiers.Public(6, 9));
            tokens.should.contain(Tokens.Keywords.Class(6, 16));
            tokens.should.contain(Tokens.Identifiers.ClassName("Nested", 6, 22));
        });
    });
});


