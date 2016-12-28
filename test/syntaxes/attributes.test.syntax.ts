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

            const input = `
[Foo]`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open(2, 1),
                Tokens.Type("Foo", 2, 2),
                Tokens.Puncuation.SquareBracket.Close(2, 5)]);
        });

        it("global attribute with specifier", () => {

            const input = `
[assembly: Foo]`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open(2, 1),
                Tokens.Keywords.AttributeSpecifier("assembly", 2, 2),
                Tokens.Puncuation.Colon(2, 10),
                Tokens.Type("Foo", 2, 12),
                Tokens.Puncuation.SquareBracket.Close(2, 15)]);
        });

        it("Two global attributes in same section with specifier", () => {

            const input = `
[module: Foo, Bar]`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open(2, 1),
                Tokens.Keywords.AttributeSpecifier("module", 2, 2),
                Tokens.Puncuation.Colon(2, 8),
                Tokens.Type("Foo", 2, 10),
                Tokens.Puncuation.Comma(2, 13),
                Tokens.Type("Bar", 2, 15),
                Tokens.Puncuation.SquareBracket.Close(2, 18)]);
        });

        it("Two global attributes in same section with specifier and empty argument lists", () => {

            const input = `
[module: Foo(), Bar()]`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open(2, 1),
                Tokens.Keywords.AttributeSpecifier("module", 2, 2),
                Tokens.Puncuation.Colon(2, 8),
                Tokens.Type("Foo", 2, 10),
                Tokens.Puncuation.Parenthesis.Open(2, 13),
                Tokens.Puncuation.Parenthesis.Close(2, 14),
                Tokens.Puncuation.Comma(2, 15),
                Tokens.Type("Bar", 2, 17),
                Tokens.Puncuation.Parenthesis.Open(2, 20),
                Tokens.Puncuation.Parenthesis.Close(2, 21),
                Tokens.Puncuation.SquareBracket.Close(2, 22)]);
        });

        it("Global attribute with one argument", () => {

            const input = `
[Foo(true)]`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open(2, 1),
                Tokens.Type("Foo", 2, 2),
                Tokens.Puncuation.Parenthesis.Open(2, 5),
                Tokens.Literals.Boolean.True(2, 6),
                Tokens.Puncuation.Parenthesis.Close(2, 10),
                Tokens.Puncuation.SquareBracket.Close(2, 11)]);
        });

        it("Global attribute with two arguments", () => {

            const input = `
[Foo(true, 42)]`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open(2, 1),
                Tokens.Type("Foo", 2, 2),
                Tokens.Puncuation.Parenthesis.Open(2, 5),
                Tokens.Literals.Boolean.True(2, 6),
                Tokens.Puncuation.Comma(2, 10),
                Tokens.Literals.Numeric.Decimal("42", 2, 12),
                Tokens.Puncuation.Parenthesis.Close(2, 14),
                Tokens.Puncuation.SquareBracket.Close(2, 15)]);
        });

        it("Global attribute with three arguments", () => {

            const input = `
[Foo(true, 42, "text")]`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open(2, 1),
                Tokens.Type("Foo", 2, 2),
                Tokens.Puncuation.Parenthesis.Open(2, 5),
                Tokens.Literals.Boolean.True(2, 6),
                Tokens.Puncuation.Comma(2, 10),
                Tokens.Literals.Numeric.Decimal("42", 2, 12),
                Tokens.Puncuation.Comma(2, 14),
                Tokens.Puncuation.String.Begin(2, 16),
                Tokens.Literals.String("text", 2, 17),
                Tokens.Puncuation.String.End(2, 21),
                Tokens.Puncuation.Parenthesis.Close(2, 22),
                Tokens.Puncuation.SquareBracket.Close(2, 23)]);
        });

        it("Global attribute with named argument", () => {

            const input = `
[Foo(Bar = 42)]`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open(2, 1),
                Tokens.Type("Foo", 2, 2),
                Tokens.Puncuation.Parenthesis.Open(2, 5),
                Tokens.Identifiers.PropertyName("Bar", 2, 6),
                Tokens.Operators.Assignment(2, 10),
                Tokens.Literals.Numeric.Decimal("42", 2, 12),
                Tokens.Puncuation.Parenthesis.Close(2, 14),
                Tokens.Puncuation.SquareBracket.Close(2, 15)]);
        });

        it("Global attribute with one positional argument and one named argument", () => {

            const input = `
[Foo(true, Bar = 42)]`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open(2, 1),
                Tokens.Type("Foo", 2, 2),
                Tokens.Puncuation.Parenthesis.Open(2, 5),
                Tokens.Literals.Boolean.True(2, 6),
                Tokens.Puncuation.Comma(2, 10),
                Tokens.Identifiers.PropertyName("Bar", 2, 12),
                Tokens.Operators.Assignment(2, 16),
                Tokens.Literals.Numeric.Decimal("42", 2, 18),
                Tokens.Puncuation.Parenthesis.Close(2, 20),
                Tokens.Puncuation.SquareBracket.Close(2, 21)]);
        });

        it("Global attribute with specifier, one positional argument, and two named arguments", () => {

            const input = `
[module: Foo(true, Bar = 42, Baz = "hello")]`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Puncuation.SquareBracket.Open(2, 1),
                Tokens.Keywords.AttributeSpecifier("module", 2, 2),
                Tokens.Puncuation.Colon(2, 8),
                Tokens.Type("Foo", 2, 10),
                Tokens.Puncuation.Parenthesis.Open(2, 13),
                Tokens.Literals.Boolean.True(2, 14),
                Tokens.Puncuation.Comma(2, 18),
                Tokens.Identifiers.PropertyName("Bar", 2, 20),
                Tokens.Operators.Assignment(2, 24),
                Tokens.Literals.Numeric.Decimal("42", 2, 26),
                Tokens.Puncuation.Comma(2, 28),
                Tokens.Identifiers.PropertyName("Baz", 2, 30),
                Tokens.Operators.Assignment(2, 34),
                Tokens.Puncuation.String.Begin(2, 36),
                Tokens.Literals.String("hello", 2, 37),
                Tokens.Puncuation.String.End(2, 42),
                Tokens.Puncuation.Parenthesis.Close(2, 43),
                Tokens.Puncuation.SquareBracket.Close(2, 44)]);
        });
    });
});