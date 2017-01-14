/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Token } from './utils/tokenize';

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
                Token.Keywords.Namespace,
                Token.Identifiers.NamespaceName("TestNamespace"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("has a namespace keyword and a dotted name", () => {

            const input = `
namespace Test.Namespace
{
}`;
            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Namespace,
                Token.Identifiers.NamespaceName("Test"),
                Token.Punctuation.Accessor,
                Token.Identifiers.NamespaceName("Namespace"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
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
                Token.Keywords.Namespace,
                Token.Identifiers.NamespaceName("TestNamespace"),
                Token.Punctuation.OpenBrace,

                Token.Keywords.Namespace,
                Token.Identifiers.NamespaceName("NestedNamespace"),
                Token.Punctuation.OpenBrace,

                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseBrace]);
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
                Token.Keywords.Using,
                Token.Identifiers.NamespaceName("UsingOne"),
                Token.Punctuation.Semicolon,

                Token.Keywords.Using,
                Token.Identifiers.AliasName("one"),
                Token.Operators.Assignment,
                Token.Type("UsingOne"),
                Token.Punctuation.Accessor,
                Token.Type("Something"),
                Token.Punctuation.Semicolon,

                Token.Keywords.Namespace,
                Token.Identifiers.NamespaceName("TestNamespace"),
                Token.Punctuation.OpenBrace,

                Token.Keywords.Using,
                Token.Identifiers.NamespaceName("UsingTwo"),
                Token.Punctuation.Semicolon,

                Token.Keywords.Using,
                Token.Identifiers.AliasName("two"),
                Token.Operators.Assignment,
                Token.Type("UsingTwo"),
                Token.Punctuation.Accessor,
                Token.Type("Something"),
                Token.Punctuation.Semicolon,

                Token.Keywords.Namespace,
                Token.Identifiers.NamespaceName("NestedNamespace"),
                Token.Punctuation.OpenBrace,

                Token.Keywords.Using,
                Token.Identifiers.NamespaceName("UsingThree"),
                Token.Punctuation.Semicolon,

                Token.Keywords.Using,
                Token.Identifiers.AliasName("three"),
                Token.Operators.Assignment,
                Token.Type("UsingThree"),
                Token.Punctuation.Accessor,
                Token.Type("Something"),
                Token.Punctuation.Semicolon,

                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseBrace]);
        });
    });
});