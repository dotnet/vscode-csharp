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
                Tokens.Keywords.Namespace,
                Tokens.Identifiers.NamespaceName("TestNamespace"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("has a namespace keyword and a dotted name", () => {

            const input = `
namespace Test.Namespace
{
}`;
            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Namespace,
                Tokens.Identifiers.NamespaceName("Test"),
                Tokens.Puncuation.Accessor,
                Tokens.Identifiers.NamespaceName("Namespace"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close]);
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
                Tokens.Keywords.Namespace,
                Tokens.Identifiers.NamespaceName("TestNamespace"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Namespace,
                Tokens.Identifiers.NamespaceName("NestedNamespace"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Puncuation.CurlyBrace.Close,
                Tokens.Puncuation.CurlyBrace.Close]);
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
                Tokens.Keywords.Using,
                Tokens.Identifiers.NamespaceName("UsingOne"),
                Tokens.Puncuation.Semicolon,

                Tokens.Keywords.Using,
                Tokens.Identifiers.AliasName("one"),
                Tokens.Operators.Assignment,
                Tokens.Type("UsingOne"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("Something"),
                Tokens.Puncuation.Semicolon,

                Tokens.Keywords.Namespace,
                Tokens.Identifiers.NamespaceName("TestNamespace"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Using,
                Tokens.Identifiers.NamespaceName("UsingTwo"),
                Tokens.Puncuation.Semicolon,

                Tokens.Keywords.Using,
                Tokens.Identifiers.AliasName("two"),
                Tokens.Operators.Assignment,
                Tokens.Type("UsingTwo"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("Something"),
                Tokens.Puncuation.Semicolon,

                Tokens.Keywords.Namespace,
                Tokens.Identifiers.NamespaceName("NestedNamespace"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Using,
                Tokens.Identifiers.NamespaceName("UsingThree"),
                Tokens.Puncuation.Semicolon,

                Tokens.Keywords.Using,
                Tokens.Identifiers.AliasName("three"),
                Tokens.Operators.Assignment,
                Tokens.Type("UsingThree"),
                Tokens.Puncuation.Accessor,
                Tokens.Type("Something"),
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close,
                Tokens.Puncuation.CurlyBrace.Close]);
        });
    });
});