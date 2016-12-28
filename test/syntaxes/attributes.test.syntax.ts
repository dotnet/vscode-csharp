/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Attributes", () => {
        it("global attribute", () => {

            const input = `[Foo]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Type("Foo"),
                Tokens.Puncuation.SquareBracket.Close]);
        });

        it("global attribute with specifier", () => {

            const input = `[assembly: Foo]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Keywords.AttributeSpecifier("assembly"),
                Tokens.Puncuation.Colon,
                Tokens.Type("Foo"),
                Tokens.Puncuation.SquareBracket.Close]);
        });

        it("Two global attributes in same section with specifier", () => {

            const input = `[module: Foo, Bar]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Keywords.AttributeSpecifier("module"),
                Tokens.Puncuation.Colon,
                Tokens.Type("Foo"),
                Tokens.Puncuation.Comma,
                Tokens.Type("Bar"),
                Tokens.Puncuation.SquareBracket.Close]);
        });

        it("Two global attributes in same section with specifier and empty argument lists", () => {

            const input = `[module: Foo(), Bar()]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Keywords.AttributeSpecifier("module"),
                Tokens.Puncuation.Colon,
                Tokens.Type("Foo"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Puncuation.Comma,
                Tokens.Type("Bar"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Puncuation.SquareBracket.Close]);
        });

        it("Global attribute with one argument", () => {

            const input = `[Foo(true)]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Type("Foo"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Literals.Boolean.True,
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Puncuation.SquareBracket.Close]);
        });

        it("Global attribute with two arguments", () => {

            const input = `[Foo(true, 42)]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Type("Foo"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Literals.Boolean.True,
                Tokens.Puncuation.Comma,
                Tokens.Literals.Numeric.Decimal("42"),
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Puncuation.SquareBracket.Close]);
        });

        it("Global attribute with three arguments", () => {

            const input = `[Foo(true, 42, "text")]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Type("Foo"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Literals.Boolean.True,
                Tokens.Puncuation.Comma,
                Tokens.Literals.Numeric.Decimal("42"),
                Tokens.Puncuation.Comma,
                Tokens.Puncuation.String.Begin,
                Tokens.Literals.String("text"),
                Tokens.Puncuation.String.End,
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Puncuation.SquareBracket.Close]);
        });

        it("Global attribute with named argument", () => {

            const input = `[Foo(Bar = 42)]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Type("Foo"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Identifiers.PropertyName("Bar"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Numeric.Decimal("42"),
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Puncuation.SquareBracket.Close]);
        });

        it("Global attribute with one positional argument and one named argument", () => {

            const input = `[Foo(true, Bar = 42)]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Type("Foo"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Literals.Boolean.True,
                Tokens.Puncuation.Comma,
                Tokens.Identifiers.PropertyName("Bar"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Numeric.Decimal("42"),
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Puncuation.SquareBracket.Close]);
        });

        it("Global attribute with specifier, one positional argument, and two named arguments", () => {

            const input = `[module: Foo(true, Bar = 42, Baz = "hello")]`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Keywords.AttributeSpecifier("module"),
                Tokens.Puncuation.Colon,
                Tokens.Type("Foo"),
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Literals.Boolean.True,
                Tokens.Puncuation.Comma,
                Tokens.Identifiers.PropertyName("Bar"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Numeric.Decimal("42"),
                Tokens.Puncuation.Comma,
                Tokens.Identifiers.PropertyName("Baz"),
                Tokens.Operators.Assignment,
                Tokens.Puncuation.String.Begin,
                Tokens.Literals.String("hello"),
                Tokens.Puncuation.String.End,
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Puncuation.SquareBracket.Close]);
        });
    });
});