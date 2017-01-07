/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Comments", () => {
        it("single-line comment", () => {
            const input = `// foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text(" foo")]);
        });

        it("single-line comment after whitespace", () => {
            const input = `    // foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Comment.LeadingWhitespace("    "),
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text(" foo")]);
        });

        it("multi-line comment", () => {
            const input = `/* foo */`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Comment.MultiLine.Start,
                Token.Comment.MultiLine.Text(" foo "),
                Token.Comment.MultiLine.End]);
        });

        it("in namespace", () => {
            const input = Input.InNamespace(`// foo`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text(" foo")]);
        });

        it("in class", () => {
            const input = Input.InClass(`// foo`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text(" foo")]);
        });

        it("in enum", () => {
            const input = Input.InEnum(`// foo`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text(" foo")]);
        });

        it("in interface", () => {
            const input = Input.InInterface(`// foo`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text(" foo")]);
        });

        it("in struct", () => {
            const input = Input.InStruct(`// foo`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text(" foo")]);
        });

        it("in method", () => {
            const input = Input.InMethod(`// foo`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text(" foo")]);
        });

        it("comment should colorize if there isn't a space before it (issue #225)", () => {
            const input = Input.InClass(`
private char GetChar()//Метод возвращающий
`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Private,
                Token.PrimitiveType.Char,
                Token.Identifiers.MethodName("GetChar"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Метод возвращающий")]);
        });
    });
});