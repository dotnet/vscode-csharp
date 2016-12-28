/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Namespace", () => {
        it("has a namespace keyword and a name", () => {

            const input = `
namespace TestNamespace
{
}`;
            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Namespace(2, 1),
                Tokens.Identifiers.NamespaceName("TestNamespace", 2, 11),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),
                Tokens.Puncuation.CurlyBrace.Close(4, 1)]);
        });

        it("has a namespace keyword and a dotted name", () => {

            const input = `
namespace Test.Namespace
{
}`;
            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Namespace(2, 1),
                Tokens.Identifiers.NamespaceName("Test", 2, 11),
                Tokens.Puncuation.Accessor(2, 15),
                Tokens.Identifiers.NamespaceName("Namespace", 2, 16),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),
                Tokens.Puncuation.CurlyBrace.Close(4, 1)]);
        });

        it("can be nested", () => {

            const input = `
namespace TestNamespace
{
    namespace NestedNamespace {

    }
}`;
            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Namespace(2, 1),
                Tokens.Identifiers.NamespaceName("TestNamespace", 2, 11),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Namespace(4, 5),
                Tokens.Identifiers.NamespaceName("NestedNamespace", 4, 15),
                Tokens.Puncuation.CurlyBrace.Open(4, 31),

                Tokens.Puncuation.CurlyBrace.Close(6, 5),
                Tokens.Puncuation.CurlyBrace.Close(7, 1)]);
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
            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Using(2, 1),
                Tokens.Identifiers.NamespaceName("UsingOne", 2, 7),
                Tokens.Puncuation.Semicolon(2, 15),

                Tokens.Keywords.Using(3, 1),
                Tokens.Identifiers.AliasName("one", 3, 7),
                Tokens.Operators.Assignment(3, 11),
                Tokens.Type("UsingOne", 3, 13),
                Tokens.Puncuation.Accessor(3, 21),
                Tokens.Type("Something", 3, 22),
                Tokens.Puncuation.Semicolon(3, 31),

                Tokens.Keywords.Namespace(5, 1),
                Tokens.Identifiers.NamespaceName("TestNamespace", 5, 11),
                Tokens.Puncuation.CurlyBrace.Open(6, 1),

                Tokens.Keywords.Using(7, 5),
                Tokens.Identifiers.NamespaceName("UsingTwo", 7, 11),
                Tokens.Puncuation.Semicolon(7, 19),

                Tokens.Keywords.Using(8, 5),
                Tokens.Identifiers.AliasName("two", 8, 11),
                Tokens.Operators.Assignment(8, 15),
                Tokens.Type("UsingTwo", 8, 17),
                Tokens.Puncuation.Accessor(8, 25),
                Tokens.Type("Something", 8, 26),
                Tokens.Puncuation.Semicolon(8, 35),

                Tokens.Keywords.Namespace(10, 5),
                Tokens.Identifiers.NamespaceName("NestedNamespace", 10, 15),
                Tokens.Puncuation.CurlyBrace.Open(11, 5),

                Tokens.Keywords.Using(12, 9),
                Tokens.Identifiers.NamespaceName("UsingThree", 12, 15),
                Tokens.Puncuation.Semicolon(12, 25),

                Tokens.Keywords.Using(13, 9),
                Tokens.Identifiers.AliasName("three", 13, 15),
                Tokens.Operators.Assignment(13, 21),
                Tokens.Type("UsingThree", 13, 23),
                Tokens.Puncuation.Accessor(13, 33),
                Tokens.Type("Something", 13, 34),
                Tokens.Puncuation.Semicolon(13, 43),

                Tokens.Puncuation.CurlyBrace.Close(14, 5),
                Tokens.Puncuation.CurlyBrace.Close(15, 1)]);
        });
    });
});