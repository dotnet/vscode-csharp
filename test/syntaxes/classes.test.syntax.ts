/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Tokens } from './utils/tokenizer';

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
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("PublicClass"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("DefaultClass"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Keywords.Modifiers.Internal,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("InternalClass"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Keywords.Modifiers.Static,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("DefaultStaticClass"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Modifiers.Static,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("PublicStaticClass"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Keywords.Modifiers.Sealed,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("DefaultSealedClass"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Modifiers.Sealed,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("PublicSealedClass"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Modifiers.Abstract,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("PublicAbstractClass"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Keywords.Modifiers.Abstract,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("DefaultAbstractClass"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("generics in identifier", () => {

            const input = Input.InNamespace(`class Dictionary<TKey, TValue> { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Dictionary<TKey, TValue>"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("inheritance", () => {

            const input = Input.InNamespace(`
class PublicClass    : IInterface,    IInterfaceTwo { }
class PublicClass<T> : Root.IInterface<Something.Nested>, Something.IInterfaceTwo { }
class PublicClass<T> : Dictionary<T, Dictionary<string, string>>, IMap<T, Dictionary<string, string>> { }`);

            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("PublicClass"),
                Tokens.Puncuation.Colon,
                Tokens.Type("IInterface"),
                Tokens.Puncuation.Comma,
                Tokens.Type("IInterfaceTwo"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("PublicClass<T>"),
                Tokens.Puncuation.Colon,
                Tokens.Type("Root"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("IInterface"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("Something"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("Nested"),
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.Comma,
                Tokens.Type("Something"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("IInterfaceTwo"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("PublicClass<T>"),
                Tokens.Puncuation.Colon,
                Tokens.Type("Dictionary"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("T"),
                Tokens.Puncuation.Comma,
                Tokens.Type("Dictionary"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("string"),
                Tokens.Puncuation.Comma,
                Tokens.Type("string"),
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.Comma,
                Tokens.Type("IMap"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("T"),
                Tokens.Puncuation.Comma,
                Tokens.Type("Dictionary"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("string"),
                Tokens.Puncuation.Comma,
                Tokens.Type("string"),
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
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
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("PublicClass<T>"),
                Tokens.Keywords.Where,
                Tokens.Type("T"),
                Tokens.Puncuation.Colon,
                Tokens.Type("ISomething"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("PublicClass<T, X>"),
                Tokens.Puncuation.Colon,
                Tokens.Type("Dictionary"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("T"),
                Tokens.Puncuation.Comma,
                Tokens.Type("List"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("string"),
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Puncuation.SquareBracket.Close,
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.Comma,
                Tokens.Type("ISomething"),
                Tokens.Keywords.Where,
                Tokens.Type("T"),
                Tokens.Puncuation.Colon,
                Tokens.Type("ICar"),
                Tokens.Puncuation.Comma,
                Tokens.Keywords.New,
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Keywords.Where,
                Tokens.Type("X"),
                Tokens.Puncuation.Colon,
                Tokens.Keywords.Struct,
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
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
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Klass"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Nested"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Puncuation.CurlyBrace.Close]);
        });
    });
});