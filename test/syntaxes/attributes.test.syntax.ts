/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Attributes", () => {
        it("global attribute", () => {

            const input = `[Foo]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Puncuation.OpenBracket,
                Token.Type("Foo"),
                Token.Puncuation.CloseBracket]);
        });

        it("global attribute with specifier", () => {

            const input = `[assembly: Foo]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Puncuation.OpenBracket,
                Token.Keywords.AttributeSpecifier("assembly"),
                Token.Puncuation.Colon,
                Token.Type("Foo"),
                Token.Puncuation.CloseBracket]);
        });

        it("Two global attributes in same section with specifier", () => {

            const input = `[module: Foo, Bar]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Puncuation.OpenBracket,
                Token.Keywords.AttributeSpecifier("module"),
                Token.Puncuation.Colon,
                Token.Type("Foo"),
                Token.Puncuation.Comma,
                Token.Type("Bar"),
                Token.Puncuation.CloseBracket]);
        });

        it("Two global attributes in same section with specifier and empty argument lists", () => {

            const input = `[module: Foo(), Bar()]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Puncuation.OpenBracket,
                Token.Keywords.AttributeSpecifier("module"),
                Token.Puncuation.Colon,
                Token.Type("Foo"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Comma,
                Token.Type("Bar"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.CloseBracket]);
        });

        it("Global attribute with one argument", () => {

            const input = `[Foo(true)]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Puncuation.OpenBracket,
                Token.Type("Foo"),
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.CloseParen,
                Token.Puncuation.CloseBracket]);
        });

        it("Global attribute with two arguments", () => {

            const input = `[Foo(true, 42)]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Puncuation.OpenBracket,
                Token.Type("Foo"),
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.Comma,
                Token.Literals.Numeric.Decimal("42"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.CloseBracket]);
        });

        it("Global attribute with three arguments", () => {

            const input = `[Foo(true, 42, "text")]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Puncuation.OpenBracket,
                Token.Type("Foo"),
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.Comma,
                Token.Literals.Numeric.Decimal("42"),
                Token.Puncuation.Comma,
                Token.Puncuation.String.Begin,
                Token.Literals.String("text"),
                Token.Puncuation.String.End,
                Token.Puncuation.CloseParen,
                Token.Puncuation.CloseBracket]);
        });

        it("Global attribute with named argument", () => {

            const input = `[Foo(Bar = 42)]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Puncuation.OpenBracket,
                Token.Type("Foo"),
                Token.Puncuation.OpenParen,
                Token.Identifiers.PropertyName("Bar"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("42"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.CloseBracket]);
        });

        it("Global attribute with one positional argument and one named argument", () => {

            const input = `[Foo(true, Bar = 42)]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Puncuation.OpenBracket,
                Token.Type("Foo"),
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.Comma,
                Token.Identifiers.PropertyName("Bar"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("42"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.CloseBracket]);
        });

        it("Global attribute with specifier, one positional argument, and two named arguments", () => {

            const input = `[module: Foo(true, Bar = 42, Baz = "hello")]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Puncuation.OpenBracket,
                Token.Keywords.AttributeSpecifier("module"),
                Token.Puncuation.Colon,
                Token.Type("Foo"),
                Token.Puncuation.OpenParen,
                Token.Literals.Boolean.True,
                Token.Puncuation.Comma,
                Token.Identifiers.PropertyName("Bar"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("42"),
                Token.Puncuation.Comma,
                Token.Identifiers.PropertyName("Baz"),
                Token.Operators.Assignment,
                Token.Puncuation.String.Begin,
                Token.Literals.String("hello"),
                Token.Puncuation.String.End,
                Token.Puncuation.CloseParen,
                Token.Puncuation.CloseBracket]);
        });
    });
});