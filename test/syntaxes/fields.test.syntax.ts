/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Tokens } from './utils/tokenizer';

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
                Tokens.Keywords.Modifiers.Private,
                Tokens.Type("List"),
                Tokens.Identifiers.FieldName("_field"),
                Tokens.Puncuation.Semicolon,

                Tokens.Keywords.Modifiers.Private,
                Tokens.Type("List"),
                Tokens.Identifiers.FieldName("field"),
                Tokens.Puncuation.Semicolon,

                Tokens.Keywords.Modifiers.Private,
                Tokens.Type("List"),
                Tokens.Identifiers.FieldName("field123"),
                Tokens.Puncuation.Semicolon]);
        });

        it("generic", () => {

            const input = Input.InClass(`private Dictionary< List<T>, Dictionary<T, D>> _field;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Private,
                Tokens.Type("Dictionary"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("List"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("T"),
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.Comma,
                Tokens.Type("Dictionary"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("T"),
                Tokens.Puncuation.Comma,
                Tokens.Type("D"),
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Identifiers.FieldName("_field"),
                Tokens.Puncuation.Semicolon]);
        });


        it("modifiers", () => {

            const input = Input.InClass(`
private static readonly List _field;
readonly string _field2;
string _field3;`);

            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Private,
                Tokens.Keywords.Modifiers.Static,
                Tokens.Keywords.Modifiers.ReadOnly,
                Tokens.Type("List"),
                Tokens.Identifiers.FieldName("_field"),
                Tokens.Puncuation.Semicolon,

                Tokens.Keywords.Modifiers.ReadOnly,
                Tokens.Type("string"),
                Tokens.Identifiers.FieldName("_field2"),
                Tokens.Puncuation.Semicolon,

                Tokens.Type("string"),
                Tokens.Identifiers.FieldName("_field3"),
                Tokens.Puncuation.Semicolon]);
        });

        it("types", () => {

            const input = Input.InClass(`
string field123;
string[] field123;`);

            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Type("string"),
                Tokens.Identifiers.FieldName("field123"),
                Tokens.Puncuation.Semicolon,

                Tokens.Type("string"),
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Puncuation.SquareBracket.Close,
                Tokens.Identifiers.FieldName("field123"),
                Tokens.Puncuation.Semicolon]);
        });

        it("assignment", () => {

            const input = Input.InClass(`
private string field = "hello";
const   bool   field = true;`);

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Private,
                Tokens.Type("string"),
                Tokens.Identifiers.FieldName("field"),
                Tokens.Operators.Assignment,
                Tokens.Puncuation.String.Begin,
                Tokens.Literals.String("hello"),
                Tokens.Puncuation.String.End,
                Tokens.Puncuation.Semicolon,

                Tokens.Keywords.Modifiers.Const,
                Tokens.Type("bool"),
                Tokens.Identifiers.FieldName("field"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Boolean.True,
                Tokens.Puncuation.Semicolon]);
        });

        it("declaration with multiple declarators", () => {

            const input = Input.InClass(`int x = 19, y = 23, z = 42;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Type("int"),
                Tokens.Identifiers.FieldName("x"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Numeric.Decimal("19"),
                Tokens.Puncuation.Comma,
                Tokens.Identifiers.FieldName("y"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Numeric.Decimal("23"),
                Tokens.Puncuation.Comma,
                Tokens.Identifiers.FieldName("z"),
                Tokens.Operators.Assignment,
                Tokens.Literals.Numeric.Decimal("42"),
                Tokens.Puncuation.Semicolon]);
        });
    });
});


