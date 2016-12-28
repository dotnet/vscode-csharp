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
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,

                Token.Keywords.Class,
                Token.Identifiers.ClassName("DefaultClass"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,

                Token.Keywords.Modifiers.Internal,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("InternalClass"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,

                Token.Keywords.Modifiers.Static,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("DefaultStaticClass"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,

                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("PublicStaticClass"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,

                Token.Keywords.Modifiers.Sealed,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("DefaultSealedClass"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,

                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Sealed,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("PublicSealedClass"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,

                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Abstract,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("PublicAbstractClass"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,

                Token.Keywords.Modifiers.Abstract,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("DefaultAbstractClass"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace]);
        });

        it("generics in identifier", () => {

            const input = Input.InNamespace(`class Dictionary<TKey, TValue> { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Class,
                Token.Identifiers.ClassName("Dictionary<TKey, TValue>"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace]);
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
                Token.Puncuation.Colon,
                Token.Type("IInterface"),
                Token.Puncuation.Comma,
                Token.Type("IInterfaceTwo"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,

                Token.Keywords.Class,
                Token.Identifiers.ClassName("PublicClass<T>"),
                Token.Puncuation.Colon,
                Token.Type("Root"),
                Token.Puncuation.Accessor,
                Token.Type("IInterface"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("Something"),
                Token.Puncuation.Accessor,
                Token.Type("Nested"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.Comma,
                Token.Type("Something"),
                Token.Puncuation.Accessor,
                Token.Type("IInterfaceTwo"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,

                Token.Keywords.Class,
                Token.Identifiers.ClassName("PublicClass<T>"),
                Token.Puncuation.Colon,
                Token.Type("Dictionary"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Puncuation.Comma,
                Token.Type("Dictionary"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("string"),
                Token.Puncuation.Comma,
                Token.Type("string"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.Comma,
                Token.Type("IMap"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Puncuation.Comma,
                Token.Type("Dictionary"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("string"),
                Token.Puncuation.Comma,
                Token.Type("string"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace]);
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
                Token.Puncuation.Colon,
                Token.Type("ISomething"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,

                Token.Keywords.Class,
                Token.Identifiers.ClassName("PublicClass<T, X>"),
                Token.Puncuation.Colon,
                Token.Type("Dictionary"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Puncuation.Comma,
                Token.Type("List"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("string"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.OpenBracket,
                Token.Puncuation.CloseBracket,
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.Comma,
                Token.Type("ISomething"),
                Token.Keywords.Where,
                Token.Type("T"),
                Token.Puncuation.Colon,
                Token.Type("ICar"),
                Token.Puncuation.Comma,
                Token.Keywords.New,
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Keywords.Where,
                Token.Type("X"),
                Token.Puncuation.Colon,
                Token.Keywords.Struct,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace]);
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
                Token.Puncuation.OpenBrace,

                Token.Keywords.Modifiers.Public,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("Nested"),
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,

                Token.Puncuation.CloseBrace]);
        });
    });
});