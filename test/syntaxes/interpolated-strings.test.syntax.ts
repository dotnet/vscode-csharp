/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Interpolated strings", () => {
        it("two interpolations", () => {

            const input = `
public class Tester
{
    string test = $"hello {one} world {two}!";
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("string"),
                Tokens.Identifiers.FieldName("test"),
                Tokens.Operators.Assignment,
                Tokens.Puncuation.InterpolatedString.Begin,
                Tokens.Literals.String("hello "),
                Tokens.Puncuation.Interpolation.Begin,
                Tokens.Variables.ReadWrite("one"),
                Tokens.Puncuation.Interpolation.End,
                Tokens.Literals.String(" world "),
                Tokens.Puncuation.Interpolation.Begin,
                Tokens.Variables.ReadWrite("two"),
                Tokens.Puncuation.Interpolation.End,
                Tokens.Literals.String("!"),
                Tokens.Puncuation.InterpolatedString.End,
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("no interpolations", () => {

            const input = `
public class Tester
{
    string test = $"hello world!";
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("string"),
                Tokens.Identifiers.FieldName("test"),
                Tokens.Operators.Assignment,
                Tokens.Puncuation.InterpolatedString.Begin,
                Tokens.Literals.String("hello world!"),
                Tokens.Puncuation.InterpolatedString.End,
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("no interpolations due to escaped braces", () => {

            const input = `
public class Tester
{
    string test = $"hello {{one}} world {{two}}!";
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("string"),
                Tokens.Identifiers.FieldName("test"),
                Tokens.Operators.Assignment,
                Tokens.Puncuation.InterpolatedString.Begin,
                Tokens.Literals.String("hello {{one}} world {{two}}!"),
                Tokens.Puncuation.InterpolatedString.End,
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("two interpolations with escaped braces", () => {

            const input = `
public class Tester
{
    string test = $"hello {{{one}}} world {{{two}}}!";
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("string"),
                Tokens.Identifiers.FieldName("test"),
                Tokens.Operators.Assignment,
                Tokens.Puncuation.InterpolatedString.Begin,
                Tokens.Literals.String("hello "),
                Tokens.Literals.String("{{"),
                Tokens.Puncuation.Interpolation.Begin,
                Tokens.Variables.ReadWrite("one"),
                Tokens.Puncuation.Interpolation.End,
                Tokens.Literals.String("}} world "),
                Tokens.Literals.String("{{"),
                Tokens.Puncuation.Interpolation.Begin,
                Tokens.Variables.ReadWrite("two"),
                Tokens.Puncuation.Interpolation.End,
                Tokens.Literals.String("}}!"),
                Tokens.Puncuation.InterpolatedString.End,
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("no interpolations due to double-escaped braces", () => {

            const input = `
public class Tester
{
    string test = $"hello {{{{one}}}} world {{{{two}}}}!";
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("string"),
                Tokens.Identifiers.FieldName("test"),
                Tokens.Operators.Assignment,
                Tokens.Puncuation.InterpolatedString.Begin,
                Tokens.Literals.String("hello {{{{one}}}} world {{{{two}}}}!"),
                Tokens.Puncuation.InterpolatedString.End,
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("break across two lines (non-verbatim)", () => {

            const input = `
public class Tester
{
    string test = $"hello
world!";
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("string"),
                Tokens.Identifiers.FieldName("test"),
                Tokens.Operators.Assignment,
                Tokens.Puncuation.InterpolatedString.Begin,
                Tokens.Literals.String("hell"),

                // Note: Because the string ended prematurely, the rest of this line and the contents of the next are junk.
                Tokens.IllegalNewLine("o"),
                Tokens.Variables.ReadWrite("world"),
                Tokens.Puncuation.String.Begin,
                Tokens.IllegalNewLine(";")]);
        });

        it("verbatim with two interpolations", () => {

            const input = `
public class Tester
{
    string test = $@"hello {one} world {two}!";
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("string"),
                Tokens.Identifiers.FieldName("test"),
                Tokens.Operators.Assignment,
                Tokens.Puncuation.InterpolatedString.VerbatimBegin,
                Tokens.Literals.String("hello "),
                Tokens.Puncuation.Interpolation.Begin,
                Tokens.Variables.ReadWrite("one"),
                Tokens.Puncuation.Interpolation.End,
                Tokens.Literals.String(" world "),
                Tokens.Puncuation.Interpolation.Begin,
                Tokens.Variables.ReadWrite("two"),
                Tokens.Puncuation.Interpolation.End,
                Tokens.Literals.String("!"),
                Tokens.Puncuation.InterpolatedString.End,
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("break across two lines with two interpolations (verbatim)", () => {

            const input = `
public class Tester
{
    string test = $@"hello {one}
    world {two}!";
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("string"),
                Tokens.Identifiers.FieldName("test"),
                Tokens.Operators.Assignment,
                Tokens.Puncuation.InterpolatedString.VerbatimBegin,
                Tokens.Literals.String("hello "),
                Tokens.Puncuation.Interpolation.Begin,
                Tokens.Variables.ReadWrite("one"),
                Tokens.Puncuation.Interpolation.End,
                Tokens.Literals.String("    world "),
                Tokens.Puncuation.Interpolation.Begin,
                Tokens.Variables.ReadWrite("two"),
                Tokens.Puncuation.Interpolation.End,
                Tokens.Literals.String("!"),
                Tokens.Puncuation.InterpolatedString.End,
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("break across two lines with no interpolations (verbatim)", () => {

            const input = `
public class Tester
{
    string test = $@"hello
    world!";
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("string"),
                Tokens.Identifiers.FieldName("test"),
                Tokens.Operators.Assignment,
                Tokens.Puncuation.InterpolatedString.VerbatimBegin,
                Tokens.Literals.String("hello"),
                Tokens.Literals.String("    world!"),
                Tokens.Puncuation.InterpolatedString.End,
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });
    });
});