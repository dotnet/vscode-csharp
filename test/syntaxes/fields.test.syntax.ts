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
                Token.Puncuation.Semicolon,

                Token.Keywords.Modifiers.Private,
                Token.Type("List"),
                Token.Identifiers.FieldName("field"),
                Token.Puncuation.Semicolon,

                Token.Keywords.Modifiers.Private,
                Token.Type("List"),
                Token.Identifiers.FieldName("field123"),
                Token.Puncuation.Semicolon]);
        });

        it("generic", () => {

            const input = Input.InClass(`private Dictionary< List<T>, Dictionary<T, D>> _field;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Private,
                Token.Type("Dictionary"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("List"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.Comma,
                Token.Type("Dictionary"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Puncuation.Comma,
                Token.Type("D"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.TypeParameters.End,
                Token.Identifiers.FieldName("_field"),
                Token.Puncuation.Semicolon]);
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
                Token.Puncuation.Semicolon,

                Token.Keywords.Modifiers.ReadOnly,
                Token.Type("string"),
                Token.Identifiers.FieldName("_field2"),
                Token.Puncuation.Semicolon,

                Token.Type("string"),
                Token.Identifiers.FieldName("_field3"),
                Token.Puncuation.Semicolon]);
        });

        it("types", () => {

            const input = Input.InClass(`
string field123;
string[] field123;`);

            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Identifiers.FieldName("field123"),
                Token.Puncuation.Semicolon,

                Token.Type("string"),
                Token.Puncuation.OpenBracket,
                Token.Puncuation.CloseBracket,
                Token.Identifiers.FieldName("field123"),
                Token.Puncuation.Semicolon]);
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
                Token.Puncuation.String.Begin,
                Token.Literals.String("hello"),
                Token.Puncuation.String.End,
                Token.Puncuation.Semicolon,

                Token.Keywords.Modifiers.Const,
                Token.Type("bool"),
                Token.Identifiers.FieldName("field"),
                Token.Operators.Assignment,
                Token.Literals.Boolean.True,
                Token.Puncuation.Semicolon]);
        });

        it("declaration with multiple declarators", () => {

            const input = Input.InClass(`int x = 19, y = 23, z = 42;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("int"),
                Token.Identifiers.FieldName("x"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("19"),
                Token.Puncuation.Comma,
                Token.Identifiers.FieldName("y"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("23"),
                Token.Puncuation.Comma,
                Token.Identifiers.FieldName("z"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("42"),
                Token.Puncuation.Semicolon]);
        });

        it("tuple type with no names and no modifiers", () => {

            const input = Input.InClass(`(int, int) x;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Puncuation.CloseParen,
                Token.Identifiers.FieldName("x"),
                Token.Puncuation.Semicolon]);
        });

        it("tuple type with no names and private modifier", () => {

            const input = Input.InClass(`private (int, int) x;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Private,
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Puncuation.CloseParen,
                Token.Identifiers.FieldName("x"),
                Token.Puncuation.Semicolon]);
        });

        it("tuple type with names and no modifiers", () => {

            const input = Input.InClass(`(int x, int y) z;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Tuple("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Tuple("y"),
                Token.Puncuation.CloseParen,
                Token.Identifiers.FieldName("z"),
                Token.Puncuation.Semicolon]);
        });

        it("tuple type with names and private modifier", () => {

            const input = Input.InClass(`private (int x, int y) z;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Private,
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Tuple("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Tuple("y"),
                Token.Puncuation.CloseParen,
                Token.Identifiers.FieldName("z"),
                Token.Puncuation.Semicolon]);
        });
    });
});


