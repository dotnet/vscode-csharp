/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("XML Doc Comments", () => {
        it("start tag", () => {
            const input = `/// <summary>`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.XmlDocComments.Begin,
                Token.XmlDocComments.Text(" "),
                Token.XmlDocComments.Tag.StartTagBegin,
                Token.XmlDocComments.Tag.Name("summary"),
                Token.XmlDocComments.Tag.StartTagEnd
            ]);
        });

        it("end tag", () => {
            const input = `/// </summary>`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.XmlDocComments.Begin,
                Token.XmlDocComments.Text(" "),
                Token.XmlDocComments.Tag.EndTagBegin,
                Token.XmlDocComments.Tag.Name("summary"),
                Token.XmlDocComments.Tag.EndTagEnd
            ]);
        });

        it("empty tag", () => {
            const input = `/// <summary />`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.XmlDocComments.Begin,
                Token.XmlDocComments.Text(" "),
                Token.XmlDocComments.Tag.EmptyTagBegin,
                Token.XmlDocComments.Tag.Name("summary"),
                Token.XmlDocComments.Tag.EmptyTagEnd
            ]);
        });

        it("start tag with attribute and single-quoted string", () => {
            const input = `/// <param name='x'>`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.XmlDocComments.Begin,
                Token.XmlDocComments.Text(" "),
                Token.XmlDocComments.Tag.StartTagBegin,
                Token.XmlDocComments.Tag.Name("param"),
                Token.XmlDocComments.Attribute.Name("name"),
                Token.XmlDocComments.Equals,
                Token.XmlDocComments.String.SingleQuoted.Begin,
                Token.XmlDocComments.String.SingleQuoted.Text("x"),
                Token.XmlDocComments.String.SingleQuoted.End,
                Token.XmlDocComments.Tag.StartTagEnd
            ]);
        });

        it("start tag with attribute and double-quoted string", () => {
            const input = `/// <param name="x">`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.XmlDocComments.Begin,
                Token.XmlDocComments.Text(" "),
                Token.XmlDocComments.Tag.StartTagBegin,
                Token.XmlDocComments.Tag.Name("param"),
                Token.XmlDocComments.Attribute.Name("name"),
                Token.XmlDocComments.Equals,
                Token.XmlDocComments.String.DoubleQuoted.Begin,
                Token.XmlDocComments.String.DoubleQuoted.Text("x"),
                Token.XmlDocComments.String.DoubleQuoted.End,
                Token.XmlDocComments.Tag.StartTagEnd
            ]);
        });

        it("comment", () => {
            const input = `/// <!-- comment -->`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.XmlDocComments.Begin,
                Token.XmlDocComments.Text(" "),
                Token.XmlDocComments.Comment.Begin,
                Token.XmlDocComments.Comment.Text(" comment "),
                Token.XmlDocComments.Comment.End
            ]);
        });

        it("cdata", () => {
            const input = `/// <![CDATA[c]]>`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.XmlDocComments.Begin,
                Token.XmlDocComments.Text(" "),
                Token.XmlDocComments.CData.Begin,
                Token.XmlDocComments.CData.Text("c"),
                Token.XmlDocComments.CData.End
            ]);
        });

        it("character entity - name", () => {
            const input = `/// &amp;`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.XmlDocComments.Begin,
                Token.XmlDocComments.Text(" "),
                Token.XmlDocComments.CharacterEntity.Begin,
                Token.XmlDocComments.CharacterEntity.Text("amp"),
                Token.XmlDocComments.CharacterEntity.End
            ]);
        });

        it("character entity - decimal", () => {
            const input = `/// &#0038;`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.XmlDocComments.Begin,
                Token.XmlDocComments.Text(" "),
                Token.XmlDocComments.CharacterEntity.Begin,
                Token.XmlDocComments.CharacterEntity.Text("#0038"),
                Token.XmlDocComments.CharacterEntity.End
            ]);
        });

        it("character entity - hdex", () => {
            const input = `/// &#x0026;`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.XmlDocComments.Begin,
                Token.XmlDocComments.Text(" "),
                Token.XmlDocComments.CharacterEntity.Begin,
                Token.XmlDocComments.CharacterEntity.Text("#x0026"),
                Token.XmlDocComments.CharacterEntity.End
            ]);
        });

        it("XML doc comments are highlighted properly on enum members (issue #706)", () => {
            const input = `
/// <summary> This is a test Enum </summary>
public enum TestEnum
{
    /// <summary> Test Value One </summary>
    TestValueOne= 0,
    /// <summary> Test Value Two </summary>
    TestValueTwo = 1
}`;

            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.XmlDocComments.Begin,
                Token.XmlDocComments.Text(" "),
                Token.XmlDocComments.Tag.StartTagBegin,
                Token.XmlDocComments.Tag.Name("summary"),
                Token.XmlDocComments.Tag.StartTagEnd,
                Token.XmlDocComments.Text(" This is a test Enum "),
                Token.XmlDocComments.Tag.EndTagBegin,
                Token.XmlDocComments.Tag.Name("summary"),
                Token.XmlDocComments.Tag.EndTagEnd,
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Enum,
                Token.Identifiers.EnumName("TestEnum"),
                Token.Punctuation.OpenBrace,
                Token.Comment.LeadingWhitespace("    "),
                Token.XmlDocComments.Begin,
                Token.XmlDocComments.Text(" "),
                Token.XmlDocComments.Tag.StartTagBegin,
                Token.XmlDocComments.Tag.Name("summary"),
                Token.XmlDocComments.Tag.StartTagEnd,
                Token.XmlDocComments.Text(" Test Value One "),
                Token.XmlDocComments.Tag.EndTagBegin,
                Token.XmlDocComments.Tag.Name("summary"),
                Token.XmlDocComments.Tag.EndTagEnd,
                Token.Identifiers.EnumMemberName("TestValueOne"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("0"),
                Token.Punctuation.Comma,
                Token.Comment.LeadingWhitespace("    "),
                Token.XmlDocComments.Begin,
                Token.XmlDocComments.Text(" "),
                Token.XmlDocComments.Tag.StartTagBegin,
                Token.XmlDocComments.Tag.Name("summary"),
                Token.XmlDocComments.Tag.StartTagEnd,
                Token.XmlDocComments.Text(" Test Value Two "),
                Token.XmlDocComments.Tag.EndTagBegin,
                Token.XmlDocComments.Tag.Name("summary"),
                Token.XmlDocComments.Tag.EndTagEnd,
                Token.Identifiers.EnumMemberName("TestValueTwo"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("1"),
                Token.Punctuation.CloseBrace
            ]);
        });
    });
});
