/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Field", () => {
        it("declaration", () => {

            const input = Input.InClass(`
private List _field;
private List field;
private List field123;`);

            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Private,
                Token.Type("List"),
                Token.Identifiers.FieldName("_field"),
                Token.Punctuation.Semicolon,

                Token.Keywords.Modifiers.Private,
                Token.Type("List"),
                Token.Identifiers.FieldName("field"),
                Token.Punctuation.Semicolon,

                Token.Keywords.Modifiers.Private,
                Token.Type("List"),
                Token.Identifiers.FieldName("field123"),
                Token.Punctuation.Semicolon]);
        });

        it("generic", () => {

            const input = Input.InClass(`private Dictionary< List<T>, Dictionary<T, D>> _field;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Private,
                Token.Type("Dictionary"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("List"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.Comma,
                Token.Type("Dictionary"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Punctuation.Comma,
                Token.Type("D"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.TypeParameters.End,
                Token.Identifiers.FieldName("_field"),
                Token.Punctuation.Semicolon]);
        });


        it("modifiers", () => {

            const input = Input.InClass(`
private static readonly List _field;
readonly string _field2;
string _field3;`);

            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Private,
                Token.Keywords.Modifiers.Static,
                Token.Keywords.Modifiers.ReadOnly,
                Token.Type("List"),
                Token.Identifiers.FieldName("_field"),
                Token.Punctuation.Semicolon,

                Token.Keywords.Modifiers.ReadOnly,
                Token.Type("string"),
                Token.Identifiers.FieldName("_field2"),
                Token.Punctuation.Semicolon,

                Token.Type("string"),
                Token.Identifiers.FieldName("_field3"),
                Token.Punctuation.Semicolon]);
        });

        it("types", () => {

            const input = Input.InClass(`
string field123;
string[] field123;`);

            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Identifiers.FieldName("field123"),
                Token.Punctuation.Semicolon,

                Token.Type("string"),
                Token.Punctuation.OpenBracket,
                Token.Punctuation.CloseBracket,
                Token.Identifiers.FieldName("field123"),
                Token.Punctuation.Semicolon]);
        });

        it("assignment", () => {

            const input = Input.InClass(`
private string field = "hello";
const   bool   field = true;`);

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Private,
                Token.Type("string"),
                Token.Identifiers.FieldName("field"),
                Token.Operators.Assignment,
                Token.Punctuation.String.Begin,
                Token.Literals.String("hello"),
                Token.Punctuation.String.End,
                Token.Punctuation.Semicolon,

                Token.Keywords.Modifiers.Const,
                Token.Type("bool"),
                Token.Identifiers.FieldName("field"),
                Token.Operators.Assignment,
                Token.Literals.Boolean.True,
                Token.Punctuation.Semicolon]);
        });

        it("declaration with multiple declarators", () => {

            const input = Input.InClass(`int x = 19, y = 23, z = 42;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("int"),
                Token.Identifiers.FieldName("x"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("19"),
                Token.Punctuation.Comma,
                Token.Identifiers.FieldName("y"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("23"),
                Token.Punctuation.Comma,
                Token.Identifiers.FieldName("z"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("42"),
                Token.Punctuation.Semicolon]);
        });

        it("tuple type with no names and no modifiers", () => {

            const input = Input.InClass(`(int, int) x;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.OpenParen,
                Token.Type("int"),
                Token.Punctuation.Comma,
                Token.Type("int"),
                Token.Punctuation.CloseParen,
                Token.Identifiers.FieldName("x"),
                Token.Punctuation.Semicolon]);
        });

        it("tuple type with no names and private modifier", () => {

            const input = Input.InClass(`private (int, int) x;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Private,
                Token.Punctuation.OpenParen,
                Token.Type("int"),
                Token.Punctuation.Comma,
                Token.Type("int"),
                Token.Punctuation.CloseParen,
                Token.Identifiers.FieldName("x"),
                Token.Punctuation.Semicolon]);
        });

        it("tuple type with names and no modifiers", () => {

            const input = Input.InClass(`(int x, int y) z;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Tuple("x"),
                Token.Punctuation.Comma,
                Token.Type("int"),
                Token.Variables.Tuple("y"),
                Token.Punctuation.CloseParen,
                Token.Identifiers.FieldName("z"),
                Token.Punctuation.Semicolon]);
        });

        it("tuple type with names and private modifier", () => {

            const input = Input.InClass(`private (int x, int y) z;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Private,
                Token.Punctuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Tuple("x"),
                Token.Punctuation.Comma,
                Token.Type("int"),
                Token.Variables.Tuple("y"),
                Token.Punctuation.CloseParen,
                Token.Identifiers.FieldName("z"),
                Token.Punctuation.Semicolon]);
        });

        it("Fields with fully-qualified names are highlighted properly (issue #1097)", () => {

            const input = Input.InClass(`
private CanvasGroup[] groups;
private UnityEngine.UI.Image[] selectedImages;
`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Private,
                Token.Type("CanvasGroup"),
                Token.Punctuation.OpenBracket,
                Token.Punctuation.CloseBracket,
                Token.Identifiers.FieldName("groups"),
                Token.Punctuation.Semicolon,
                Token.Keywords.Modifiers.Private,
                Token.Type("UnityEngine"),
                Token.Punctuation.Accessor,
                Token.Type("UI"),
                Token.Punctuation.Accessor,
                Token.Type("Image"),
                Token.Punctuation.OpenBracket,
                Token.Punctuation.CloseBracket,
                Token.Identifiers.FieldName("selectedImages"),
                Token.Punctuation.Semicolon
            ]);
        });
    });
});
