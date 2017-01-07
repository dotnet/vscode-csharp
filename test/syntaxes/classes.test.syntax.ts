/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Class", () => {
        it("class keyword and storage modifiers", () => {

            const input = Input.InNamespace(`
public             class PublicClass { }

                    class DefaultClass { }

internal           class InternalClass { }

            static   class DefaultStaticClass { }

public    static   class PublicStaticClass { }

            sealed   class DefaultSealedClass { }

public    sealed   class PublicSealedClass { }

public    abstract class PublicAbstractClass { }

            abstract class DefaultAbstractClass { }`);

            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("PublicClass"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,

                Token.Keywords.Class,
                Token.Identifiers.ClassName("DefaultClass"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,

                Token.Keywords.Modifiers.Internal,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("InternalClass"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,

                Token.Keywords.Modifiers.Static,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("DefaultStaticClass"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,

                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("PublicStaticClass"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,

                Token.Keywords.Modifiers.Sealed,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("DefaultSealedClass"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,

                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Sealed,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("PublicSealedClass"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,

                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Abstract,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("PublicAbstractClass"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,

                Token.Keywords.Modifiers.Abstract,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("DefaultAbstractClass"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("generics in identifier", () => {

            const input = Input.InNamespace(`class Dictionary<TKey, TValue> { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Class,
                Token.Identifiers.ClassName("Dictionary<TKey, TValue>"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("inheritance", () => {

            const input = Input.InNamespace(`
class PublicClass    : IInterface,    IInterfaceTwo { }
class PublicClass<T> : Root.IInterface<Something.Nested>, Something.IInterfaceTwo { }
class PublicClass<T> : Dictionary<T, Dictionary<string, string>>, IMap<T, Dictionary<string, string>> { }`);

            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Class,
                Token.Identifiers.ClassName("PublicClass"),
                Token.Punctuation.Colon,
                Token.Type("IInterface"),
                Token.Punctuation.Comma,
                Token.Type("IInterfaceTwo"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,

                Token.Keywords.Class,
                Token.Identifiers.ClassName("PublicClass<T>"),
                Token.Punctuation.Colon,
                Token.Type("Root"),
                Token.Punctuation.Accessor,
                Token.Type("IInterface"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("Something"),
                Token.Punctuation.Accessor,
                Token.Type("Nested"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.Comma,
                Token.Type("Something"),
                Token.Punctuation.Accessor,
                Token.Type("IInterfaceTwo"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,

                Token.Keywords.Class,
                Token.Identifiers.ClassName("PublicClass<T>"),
                Token.Punctuation.Colon,
                Token.Type("Dictionary"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Punctuation.Comma,
                Token.Type("Dictionary"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("string"),
                Token.Punctuation.Comma,
                Token.Type("string"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.Comma,
                Token.Type("IMap"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Punctuation.Comma,
                Token.Type("Dictionary"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("string"),
                Token.Punctuation.Comma,
                Token.Type("string"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("generic constraints", () => {

            const input = Input.InNamespace(`
class PublicClass<T> where T : ISomething { }
class PublicClass<T, X> : Dictionary<T, List<string>[]>, ISomething
    where T : ICar, new()
    where X : struct
{
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Class,
                Token.Identifiers.ClassName("PublicClass<T>"),
                Token.Keywords.Where,
                Token.Type("T"),
                Token.Punctuation.Colon,
                Token.Type("ISomething"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,

                Token.Keywords.Class,
                Token.Identifiers.ClassName("PublicClass<T, X>"),
                Token.Punctuation.Colon,
                Token.Type("Dictionary"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Punctuation.Comma,
                Token.Type("List"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("string"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.OpenBracket,
                Token.Punctuation.CloseBracket,
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.Comma,
                Token.Type("ISomething"),
                Token.Keywords.Where,
                Token.Type("T"),
                Token.Punctuation.Colon,
                Token.Type("ICar"),
                Token.Punctuation.Comma,
                Token.Keywords.New,
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Keywords.Where,
                Token.Type("X"),
                Token.Punctuation.Colon,
                Token.Keywords.Struct,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("nested class", () => {

            const input = Input.InNamespace(`
class Klass
{
    public class Nested
    {

    }
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Class,
                Token.Identifiers.ClassName("Klass"),
                Token.Punctuation.OpenBrace,

                Token.Keywords.Modifiers.Public,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("Nested"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,

                Token.Punctuation.CloseBrace]);
        });
    });
});