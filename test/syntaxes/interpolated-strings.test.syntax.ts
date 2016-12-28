/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { Tokens } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe("Interpolated strings", () => {
        it("two interpolations", () => {

            const input = `
public class Tester
{
    string test = $"hello {one} world {two}!";
}`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Type("string", 4, 5),
                Tokens.Identifiers.FieldName("test", 4, 12),
                Tokens.Operators.Assignment(4, 17),
                Tokens.Puncuation.InterpolatedString.Begin(4, 19),
                Tokens.Literals.String("hello ", 4, 21),
                Tokens.Puncuation.Interpolation.Begin(4, 27),
                Tokens.Variables.ReadWrite("one", 4, 28),
                Tokens.Puncuation.Interpolation.End(4, 31),
                Tokens.Literals.String(" world ", 4, 32),
                Tokens.Puncuation.Interpolation.Begin(4, 39),
                Tokens.Variables.ReadWrite("two", 4, 40),
                Tokens.Puncuation.Interpolation.End(4, 43),
                Tokens.Literals.String("!", 4, 44),
                Tokens.Puncuation.InterpolatedString.End(4, 45),
                Tokens.Puncuation.Semicolon(4, 46),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
        });

        it("no interpolations", () => {

            const input = `
public class Tester
{
    string test = $"hello world!";
}`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Type("string", 4, 5),
                Tokens.Identifiers.FieldName("test", 4, 12),
                Tokens.Operators.Assignment(4, 17),
                Tokens.Puncuation.InterpolatedString.Begin(4, 19),
                Tokens.Literals.String("hello world!", 4, 21),
                Tokens.Puncuation.InterpolatedString.End(4, 33),
                Tokens.Puncuation.Semicolon(4, 34),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
        });

        it("break across two lines (non-verbatim)", () => {

            const input = `
public class Tester
{
    string test = $"hello
world!";
}`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Type("string", 4, 5),
                Tokens.Identifiers.FieldName("test", 4, 12),
                Tokens.Operators.Assignment(4, 17),
                Tokens.Puncuation.InterpolatedString.Begin(4, 19),
                Tokens.Literals.String("hell", 4, 21),

                // Note: Because the string ended prematurely, the rest of this line and the contents of the next are junk.
                Tokens.IllegalNewLine("o", 4, 25),
                Tokens.Variables.ReadWrite("world", 5, 1),
                Tokens.Puncuation.String.Begin(5, 7),
                Tokens.IllegalNewLine(";", 5, 8)]);
        });

        it("verbatim with two interpolations", () => {

            const input = `
public class Tester
{
    string test = $@"hello {one} world {two}!";
}`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Type("string", 4, 5),
                Tokens.Identifiers.FieldName("test", 4, 12),
                Tokens.Operators.Assignment(4, 17),
                Tokens.Puncuation.InterpolatedString.VerbatimBegin(4, 19),
                Tokens.Literals.String("hello ", 4, 22),
                Tokens.Puncuation.Interpolation.Begin(4, 28),
                Tokens.Variables.ReadWrite("one", 4, 29),
                Tokens.Puncuation.Interpolation.End(4, 32),
                Tokens.Literals.String(" world ", 4, 33),
                Tokens.Puncuation.Interpolation.Begin(4, 40),
                Tokens.Variables.ReadWrite("two", 4, 41),
                Tokens.Puncuation.Interpolation.End(4, 44),
                Tokens.Literals.String("!", 4, 45),
                Tokens.Puncuation.InterpolatedString.End(4, 46),
                Tokens.Puncuation.Semicolon(4, 47),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
        });

        it("break across two lines with two interpolations (verbatim)", () => {

            const input = `
public class Tester
{
    string test = $@"hello {one}
    world {two}!";
}`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Type("string", 4, 5),
                Tokens.Identifiers.FieldName("test", 4, 12),
                Tokens.Operators.Assignment(4, 17),
                Tokens.Puncuation.InterpolatedString.VerbatimBegin(4, 19),
                Tokens.Literals.String("hello ", 4, 22),
                Tokens.Puncuation.Interpolation.Begin(4, 28),
                Tokens.Variables.ReadWrite("one", 4, 29),
                Tokens.Puncuation.Interpolation.End(4, 32),
                Tokens.Literals.String("    world ", 5, 1),
                Tokens.Puncuation.Interpolation.Begin(5, 11),
                Tokens.Variables.ReadWrite("two", 5, 12),
                Tokens.Puncuation.Interpolation.End(5, 15),
                Tokens.Literals.String("!", 5, 16),
                Tokens.Puncuation.InterpolatedString.End(5, 17),
                Tokens.Puncuation.Semicolon(5, 18),

                Tokens.Puncuation.CurlyBrace.Close(6, 1)]);
        });

        it("break across two lines with no interpolations (verbatim)", () => {

            const input = `
public class Tester
{
    string test = $@"hello
    world!";
}`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Type("string", 4, 5),
                Tokens.Identifiers.FieldName("test", 4, 12),
                Tokens.Operators.Assignment(4, 17),
                Tokens.Puncuation.InterpolatedString.VerbatimBegin(4, 19),
                Tokens.Literals.String("hello", 4, 22),
                Tokens.Literals.String("    world!", 5, 1),
                Tokens.Puncuation.InterpolatedString.End(5, 11),
                Tokens.Puncuation.Semicolon(5, 12),

                Tokens.Puncuation.CurlyBrace.Close(6, 1)]);
        });
    });
});


