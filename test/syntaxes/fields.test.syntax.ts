/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Field", function () {
        it("declaration", function () {

            const input = `
public class Tester
{
    private List _field;
    private List field;
    private List field123;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

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
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("generic", () => {

            const input = `
public class Tester
{
    private Dictionary< List<T>, Dictionary<T, D>> _field;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

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
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });


        it("modifiers", () => {

            const input = `
public class Tester
{
    private static readonly List _field;
    readonly string _field2;
    string _field3;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

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
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("types", () => {

            const input = `
public class Tester
{
    string field123;
    string[] field123;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("string"),
                Tokens.Identifiers.FieldName("field123"),
                Tokens.Puncuation.Semicolon,

                Tokens.Type("string"),
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Puncuation.SquareBracket.Close,
                Tokens.Identifiers.FieldName("field123"),
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("assignment", () => {

            const input = `
public class Tester
{
    private string field = "hello";
    const   bool   field = true;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

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
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("declaration with multiple declarators", () => {

            const input = `
public class Tester
{
    int x = 19, y = 23, z = 42;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

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
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });
    });
});


