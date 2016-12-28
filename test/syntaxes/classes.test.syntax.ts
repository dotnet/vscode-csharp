/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { Tokens } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

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
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Namespace(2, 1),
                Tokens.Identifiers.NamespaceName("TestNamespace", 2, 11),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Public(4, 5),
                Tokens.Keywords.Class(4, 24),
                Tokens.Identifiers.ClassName("PublicClass", 4, 30),
                Tokens.Puncuation.CurlyBrace.Open(4, 42),
                Tokens.Puncuation.CurlyBrace.Close(4, 44),

                Tokens.Keywords.Class(6, 24),
                Tokens.Identifiers.ClassName("DefaultClass", 6, 30),
                Tokens.Puncuation.CurlyBrace.Open(6, 43),
                Tokens.Puncuation.CurlyBrace.Close(6, 45),

                Tokens.Keywords.Modifiers.Internal(8, 5),
                Tokens.Keywords.Class(8, 24),
                Tokens.Identifiers.ClassName("InternalClass", 8, 30),
                Tokens.Puncuation.CurlyBrace.Open(8, 44),
                Tokens.Puncuation.CurlyBrace.Close(8, 46),

                Tokens.Keywords.Modifiers.Static(10, 15),
                Tokens.Keywords.Class(10, 24),
                Tokens.Identifiers.ClassName("DefaultStaticClass", 10, 30),
                Tokens.Puncuation.CurlyBrace.Open(10, 49),
                Tokens.Puncuation.CurlyBrace.Close(10, 51),

                Tokens.Keywords.Modifiers.Public(12, 5),
                Tokens.Keywords.Modifiers.Static(12, 15),
                Tokens.Keywords.Class(12, 24),
                Tokens.Identifiers.ClassName("PublicStaticClass", 12, 30),
                Tokens.Puncuation.CurlyBrace.Open(12, 48),
                Tokens.Puncuation.CurlyBrace.Close(12, 50),

                Tokens.Keywords.Modifiers.Sealed(14, 15),
                Tokens.Keywords.Class(14, 24),
                Tokens.Identifiers.ClassName("DefaultSealedClass", 14, 30),
                Tokens.Puncuation.CurlyBrace.Open(14, 49),
                Tokens.Puncuation.CurlyBrace.Close(14, 51),

                Tokens.Keywords.Modifiers.Public(16, 5),
                Tokens.Keywords.Modifiers.Sealed(16, 15),
                Tokens.Keywords.Class(16, 24),
                Tokens.Identifiers.ClassName("PublicSealedClass", 16, 30),
                Tokens.Puncuation.CurlyBrace.Open(16, 48),
                Tokens.Puncuation.CurlyBrace.Close(16, 50),

                Tokens.Keywords.Modifiers.Public(18, 5),
                Tokens.Keywords.Modifiers.Abstract(18, 15),
                Tokens.Keywords.Class(18, 24),
                Tokens.Identifiers.ClassName("PublicAbstractClass", 18, 30),
                Tokens.Puncuation.CurlyBrace.Open(18, 50),
                Tokens.Puncuation.CurlyBrace.Close(18, 52),

                Tokens.Keywords.Modifiers.Abstract(20, 15),
                Tokens.Keywords.Class(20, 24),
                Tokens.Identifiers.ClassName("DefaultAbstractClass", 20, 30),
                Tokens.Puncuation.CurlyBrace.Open(20, 51),
                Tokens.Puncuation.CurlyBrace.Close(20, 53),

                Tokens.Puncuation.CurlyBrace.Close(21, 1)]);
        });

        it("generics in identifier", () => {

            const input = `
namespace TestNamespace
{
    class Dictionary<TKey, TValue> { }
}`;
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Namespace(2, 1),
                Tokens.Identifiers.NamespaceName("TestNamespace", 2, 11),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Class(4, 5),
                Tokens.Identifiers.ClassName("Dictionary<TKey, TValue>", 4, 11),
                Tokens.Puncuation.CurlyBrace.Open(4, 36),
                Tokens.Puncuation.CurlyBrace.Close(4, 38),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
        });

        it("inheritance", () => {

            const input = `
namespace TestNamespace
{
    class PublicClass    : IInterface,    IInterfaceTwo { }
    class PublicClass<T> : Root.IInterface<Something.Nested>, Something.IInterfaceTwo { }
    class PublicClass<T> : Dictionary<T, Dictionary<string, string>>, IMap<T, Dictionary<string, string>> { }
}`;
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Namespace(2, 1),
                Tokens.Identifiers.NamespaceName("TestNamespace", 2, 11),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Class(4, 5),
                Tokens.Identifiers.ClassName("PublicClass", 4, 11),
                Tokens.Puncuation.Colon(4, 26),
                Tokens.Type("IInterface", 4, 28),
                Tokens.Puncuation.Comma(4, 38),
                Tokens.Type("IInterfaceTwo", 4, 43),
                Tokens.Puncuation.CurlyBrace.Open(4, 57),
                Tokens.Puncuation.CurlyBrace.Close(4, 59),

                Tokens.Keywords.Class(5, 5),
                Tokens.Identifiers.ClassName("PublicClass<T>", 5, 11),
                Tokens.Puncuation.Colon(5, 26),
                Tokens.Type("Root", 5, 28),
                Tokens.Puncuation.Accessor(5, 32),
                Tokens.Type("IInterface", 5, 33),
                Tokens.Puncuation.TypeParameters.Begin(5, 43),
                Tokens.Type("Something", 5, 44),
                Tokens.Puncuation.Accessor(5, 53),
                Tokens.Type("Nested", 5, 54),
                Tokens.Puncuation.TypeParameters.End(5, 60),
                Tokens.Puncuation.Comma(5, 61),
                Tokens.Type("Something", 5, 63),
                Tokens.Puncuation.Accessor(5, 72),
                Tokens.Type("IInterfaceTwo", 5, 73),
                Tokens.Puncuation.CurlyBrace.Open(5, 87),
                Tokens.Puncuation.CurlyBrace.Close(5, 89),

                Tokens.Keywords.Class(6, 5),
                Tokens.Identifiers.ClassName("PublicClass<T>", 6, 11),
                Tokens.Puncuation.Colon(6, 26),
                Tokens.Type("Dictionary", 6, 28),
                Tokens.Puncuation.TypeParameters.Begin(6, 38),
                Tokens.Type("T", 6, 39),
                Tokens.Puncuation.Comma(6, 40),
                Tokens.Type("Dictionary", 6, 42),
                Tokens.Puncuation.TypeParameters.Begin(6, 52),
                Tokens.Type("string", 6, 53),
                Tokens.Puncuation.Comma(6, 59),
                Tokens.Type("string", 6, 61),
                Tokens.Puncuation.TypeParameters.End(6, 67),
                Tokens.Puncuation.TypeParameters.End(6, 68),
                Tokens.Puncuation.Comma(6, 69),
                Tokens.Type("IMap", 6, 71),
                Tokens.Puncuation.TypeParameters.Begin(6, 75),
                Tokens.Type("T", 6, 76),
                Tokens.Puncuation.Comma(6, 77),
                Tokens.Type("Dictionary", 6, 79),
                Tokens.Puncuation.TypeParameters.Begin(6, 89),
                Tokens.Type("string", 6, 90),
                Tokens.Puncuation.Comma(6, 96),
                Tokens.Type("string", 6, 98),
                Tokens.Puncuation.TypeParameters.End(6, 104),
                Tokens.Puncuation.TypeParameters.End(6, 105),
                Tokens.Puncuation.CurlyBrace.Open(6, 107),
                Tokens.Puncuation.CurlyBrace.Close(6, 109),

                Tokens.Puncuation.CurlyBrace.Close(7, 1)]);
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
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Namespace(2, 1),
                Tokens.Identifiers.NamespaceName("TestNamespace", 2, 11),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Class(4, 5),
                Tokens.Identifiers.ClassName("PublicClass<T>", 4, 11),
                Tokens.Keywords.Where(4, 26),
                Tokens.Type("T", 4, 32),
                Tokens.Puncuation.Colon(4, 34),
                Tokens.Type("ISomething", 4, 36),
                Tokens.Puncuation.CurlyBrace.Open(4, 47),
                Tokens.Puncuation.CurlyBrace.Close(4, 49),

                Tokens.Keywords.Class(5, 5),
                Tokens.Identifiers.ClassName("PublicClass<T, X>", 5, 11),
                Tokens.Puncuation.Colon(5, 29),
                Tokens.Type("Dictionary", 5, 31),
                Tokens.Puncuation.TypeParameters.Begin(5, 41),
                Tokens.Type("T", 5, 42),
                Tokens.Puncuation.Comma(5, 43),
                Tokens.Type("List", 5, 45),
                Tokens.Puncuation.TypeParameters.Begin(5, 49),
                Tokens.Type("string", 5, 50),
                Tokens.Puncuation.TypeParameters.End(5, 56),
                Tokens.Puncuation.SquareBracket.Open(5, 57),
                Tokens.Puncuation.SquareBracket.Close(5, 58),
                Tokens.Puncuation.TypeParameters.End(5, 59),
                Tokens.Puncuation.Comma(5, 60),
                Tokens.Type("ISomething", 5, 62),
                Tokens.Keywords.Where(6, 9),
                Tokens.Type("T", 6, 15),
                Tokens.Puncuation.Colon(6, 17),
                Tokens.Type("ICar", 6, 19),
                Tokens.Puncuation.Comma(6, 23),
                Tokens.Keywords.New(6, 25),
                Tokens.Puncuation.Parenthesis.Open(6, 28),
                Tokens.Puncuation.Parenthesis.Close(6, 29),
                Tokens.Keywords.Where(7, 9),
                Tokens.Type("X", 7, 15),
                Tokens.Puncuation.Colon(7, 17),
                Tokens.Keywords.Struct(7, 19),
                Tokens.Puncuation.CurlyBrace.Open(8, 5),
                Tokens.Puncuation.CurlyBrace.Close(9, 5),

                Tokens.Puncuation.CurlyBrace.Close(10, 1)]);
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
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Namespace(2, 1),
                Tokens.Identifiers.NamespaceName("TestNamespace", 2, 11),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Class(4, 5),
                Tokens.Identifiers.ClassName("Klass", 4, 11),
                Tokens.Puncuation.CurlyBrace.Open(5, 5),

                Tokens.Keywords.Modifiers.Public(6, 9),
                Tokens.Keywords.Class(6, 16),
                Tokens.Identifiers.ClassName("Nested", 6, 22),
                Tokens.Puncuation.CurlyBrace.Open(7, 9),
                Tokens.Puncuation.CurlyBrace.Close(9, 9),

                Tokens.Puncuation.CurlyBrace.Close(10, 5),
                
                Tokens.Puncuation.CurlyBrace.Close(11, 1)]);
        });
    });
});


