/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Literals - string", () => {
        it("simple", () => {

            const input = Input.InClass(`string test = "hello world!";`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.String.Begin,
                Token.Literals.String("hello world!"),
                Token.Punctuation.String.End,
                Token.Punctuation.Semicolon]);
        });

        it("escaped double-quote", () => {

            const input = Input.InClass(`string test = "hello \\"world!\\"";`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.String.Begin,
                Token.Literals.String("hello "),
                Token.Literals.CharacterEscape("\\\""),
                Token.Literals.String("world!"),
                Token.Literals.CharacterEscape("\\\""),
                Token.Punctuation.String.End,
                Token.Punctuation.Semicolon]);
        });

        it("line break before close quote", () => {

            const input = Input.InClass(
`string test = "hello 
world!";`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.String.Begin,
                Token.Literals.String("hello"),

                // Note: Because the string ended prematurely, the rest of this line and the contents of the next are junk.
                Token.IllegalNewLine(" "),
                Token.Variables.ReadWrite("world"),
                Token.Operators.Logical.Not,
                Token.Punctuation.String.Begin,
                Token.IllegalNewLine(";")]);
        });

        it("simple (verbatim)", () => {

            const input = Input.InClass(`string test = @"hello world!";`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.String.VerbatimBegin,
                Token.Literals.String("hello world!"),
                Token.Punctuation.String.End,
                Token.Punctuation.Semicolon]);
        });

        it("escaped double-quote (verbatim)", () => {

            const input = Input.InClass("string test = @\"hello \"\"world!\"\"\";");
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.String.VerbatimBegin,
                Token.Literals.String("hello "),
                Token.Literals.CharacterEscape("\"\""),
                Token.Literals.String("world!"),
                Token.Literals.CharacterEscape("\"\""),
                Token.Punctuation.String.End,
                Token.Punctuation.Semicolon]);
        });

        it("line break before close quote (verbatim)", () => {

            const input = Input.InClass(
`string test = @"hello 
world!";`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Identifiers.FieldName("test"),
                Token.Operators.Assignment,
                Token.Punctuation.String.VerbatimBegin,
                Token.Literals.String("hello "),
                Token.Literals.String("world!"),
                Token.Punctuation.String.End,
                Token.Punctuation.Semicolon]);
        });
    });
});