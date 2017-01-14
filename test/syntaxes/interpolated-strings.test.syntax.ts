/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Interpolated strings", () => {
        it("two interpolations", () => {

            const input = Input.InClass(`string test = $"hello {one} world {two}!";`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.String,
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.InterpolatedString.Begin,
                Token.Literals.String("hello "),
                Token.Punctuation.Interpolation.Begin,
                Token.Variables.ReadWrite("one"),
                Token.Punctuation.Interpolation.End,
                Token.Literals.String(" world "),
                Token.Punctuation.Interpolation.Begin,
                Token.Variables.ReadWrite("two"),
                Token.Punctuation.Interpolation.End,
                Token.Literals.String("!"),
                Token.Punctuation.InterpolatedString.End,
                Token.Punctuation.Semicolon]);
        });

        it("no interpolations", () => {

            const input = Input.InClass(`string test = $"hello world!";`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.String,
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.InterpolatedString.Begin,
                Token.Literals.String("hello world!"),
                Token.Punctuation.InterpolatedString.End,
                Token.Punctuation.Semicolon]);
        });

        it("no interpolations due to escaped braces", () => {

            const input = Input.InClass(`string test = $"hello {{one}} world {{two}}!";`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.String,
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.InterpolatedString.Begin,
                Token.Literals.String("hello {{one}} world {{two}}!"),
                Token.Punctuation.InterpolatedString.End,
                Token.Punctuation.Semicolon]);
        });

        it("two interpolations with escaped braces", () => {

            const input = Input.InClass(`string test = $"hello {{{one}}} world {{{two}}}!";`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.String,
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.InterpolatedString.Begin,
                Token.Literals.String("hello "),
                Token.Literals.String("{{"),
                Token.Punctuation.Interpolation.Begin,
                Token.Variables.ReadWrite("one"),
                Token.Punctuation.Interpolation.End,
                Token.Literals.String("}} world "),
                Token.Literals.String("{{"),
                Token.Punctuation.Interpolation.Begin,
                Token.Variables.ReadWrite("two"),
                Token.Punctuation.Interpolation.End,
                Token.Literals.String("}}!"),
                Token.Punctuation.InterpolatedString.End,
                Token.Punctuation.Semicolon]);
        });

        it("no interpolations due to double-escaped braces", () => {

            const input = Input.InClass(`string test = $"hello {{{{one}}}} world {{{{two}}}}!";`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.String,
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.InterpolatedString.Begin,
                Token.Literals.String("hello {{{{one}}}} world {{{{two}}}}!"),
                Token.Punctuation.InterpolatedString.End,
                Token.Punctuation.Semicolon]);
        });

        it("break across two lines (non-verbatim)", () => {

            const input = Input.InClass(`
string test = $"hello
world!";`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.String,
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.InterpolatedString.Begin,
                Token.Literals.String("hell"),

                // Note: Because the string ended prematurely, the rest of this line and the contents of the next are junk.
                Token.IllegalNewLine("o"),
                Token.Variables.ReadWrite("world"),
                Token.Operators.Logical.Not,
                Token.Punctuation.String.Begin,
                Token.IllegalNewLine(";")]);
        });

        it("verbatim with two interpolations", () => {

            const input = Input.InClass(`string test = $@"hello {one} world {two}!";`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.String,
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.InterpolatedString.VerbatimBegin,
                Token.Literals.String("hello "),
                Token.Punctuation.Interpolation.Begin,
                Token.Variables.ReadWrite("one"),
                Token.Punctuation.Interpolation.End,
                Token.Literals.String(" world "),
                Token.Punctuation.Interpolation.Begin,
                Token.Variables.ReadWrite("two"),
                Token.Punctuation.Interpolation.End,
                Token.Literals.String("!"),
                Token.Punctuation.InterpolatedString.End,
                Token.Punctuation.Semicolon]);
        });

        it("verbatim with two interpolations and escaped double-quotes", () => {

            const input = Input.InClass(`string test = $@"hello {one} ""world"" {two}!";`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.String,
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.InterpolatedString.VerbatimBegin,
                Token.Literals.String("hello "),
                Token.Punctuation.Interpolation.Begin,
                Token.Variables.ReadWrite("one"),
                Token.Punctuation.Interpolation.End,
                Token.Literals.String(" "),
                Token.Literals.CharacterEscape("\"\""),
                Token.Literals.String("world"),
                Token.Literals.CharacterEscape("\"\""),
                Token.Literals.String(" "),
                Token.Punctuation.Interpolation.Begin,
                Token.Variables.ReadWrite("two"),
                Token.Punctuation.Interpolation.End,
                Token.Literals.String("!"),
                Token.Punctuation.InterpolatedString.End,
                Token.Punctuation.Semicolon]);
        });

        it("break across two lines with two interpolations (verbatim)", () => {

            const input = Input.InClass(`
string test = $@"hello {one}
world {two}!";`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.String,
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.InterpolatedString.VerbatimBegin,
                Token.Literals.String("hello "),
                Token.Punctuation.Interpolation.Begin,
                Token.Variables.ReadWrite("one"),
                Token.Punctuation.Interpolation.End,
                Token.Literals.String("world "),
                Token.Punctuation.Interpolation.Begin,
                Token.Variables.ReadWrite("two"),
                Token.Punctuation.Interpolation.End,
                Token.Literals.String("!"),
                Token.Punctuation.InterpolatedString.End,
                Token.Punctuation.Semicolon]);
        });

        it("break across two lines with no interpolations (verbatim)", () => {

            const input = Input.InClass(`
string test = $@"hello
world!";`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.String,
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.InterpolatedString.VerbatimBegin,
                Token.Literals.String("hello"),
                Token.Literals.String("world!"),
                Token.Punctuation.InterpolatedString.End,
                Token.Punctuation.Semicolon]);
        });
    });
});