/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { Tokens } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

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

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Private(4, 5),
                Tokens.Type("List", 4, 13),
                Tokens.Identifiers.FieldName("_field", 4, 18),
                Tokens.Puncuation.Semicolon(4, 24),

                Tokens.Keywords.Modifiers.Private(5, 5),
                Tokens.Type("List", 5, 13),
                Tokens.Identifiers.FieldName("field", 5, 18),
                Tokens.Puncuation.Semicolon(5, 23),

                Tokens.Keywords.Modifiers.Private(6, 5),
                Tokens.Type("List", 6, 13),
                Tokens.Identifiers.FieldName("field123", 6, 18),
                Tokens.Puncuation.Semicolon(6, 26),

                Tokens.Puncuation.CurlyBrace.Close(7, 1)]);
        });

        it("generic", () => {

            const input = `
public class Tester
{
    private Dictionary< List<T>, Dictionary<T, D>> _field;
}`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Private(4, 5),
                Tokens.Type("Dictionary", 4, 13),
                Tokens.Puncuation.TypeParameters.Begin(4, 23),
                Tokens.Type("List", 4, 25),
                Tokens.Puncuation.TypeParameters.Begin(4, 29),
                Tokens.Type("T", 4, 30),
                Tokens.Puncuation.TypeParameters.End(4, 31),
                Tokens.Puncuation.Comma(4, 32),
                Tokens.Type("Dictionary", 4, 34),
                Tokens.Puncuation.TypeParameters.Begin(4, 44),
                Tokens.Type("T", 4, 45),
                Tokens.Puncuation.Comma(4, 46),
                Tokens.Type("D", 4, 48),
                Tokens.Puncuation.TypeParameters.End(4, 49),
                Tokens.Puncuation.TypeParameters.End(4, 50),
                Tokens.Identifiers.FieldName("_field", 4, 52),
                Tokens.Puncuation.Semicolon(4, 58),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
        });


        it("modifiers", () => {

            const input = `
public class Tester
{
    private static readonly List _field;
    readonly string _field2;
    string _field3;
}`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Private(4, 5),
                Tokens.Keywords.Modifiers.Static(4, 13),
                Tokens.Keywords.Modifiers.ReadOnly(4, 20),
                Tokens.Type("List", 4, 29),
                Tokens.Identifiers.FieldName("_field", 4, 34),
                Tokens.Puncuation.Semicolon(4, 40),

                Tokens.Keywords.Modifiers.ReadOnly(5, 5),
                Tokens.Type("string", 5, 14),
                Tokens.Identifiers.FieldName("_field2", 5, 21),
                Tokens.Puncuation.Semicolon(5, 28),

                Tokens.Type("string", 6, 5),
                Tokens.Identifiers.FieldName("_field3", 6, 12),
                Tokens.Puncuation.Semicolon(6, 19),

                Tokens.Puncuation.CurlyBrace.Close(7, 1)]);
        });

        it("types", () => {

            const input = `
public class Tester
{
    string field123;
    string[] field123;
}`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Type("string", 4, 5),
                Tokens.Identifiers.FieldName("field123", 4, 12),
                Tokens.Puncuation.Semicolon(4, 20),

                Tokens.Type("string", 5, 5),
                Tokens.Puncuation.SquareBracket.Open(5, 11),
                Tokens.Puncuation.SquareBracket.Close(5, 12),
                Tokens.Identifiers.FieldName("field123", 5, 14),
                Tokens.Puncuation.Semicolon(5, 22),

                Tokens.Puncuation.CurlyBrace.Close(6, 1)]);
        });

        it("assignment", () => {

            const input = `
public class Tester
{
    private string field = "hello";
    const   bool   field = true;
}`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Private(4, 5),
                Tokens.Type("string", 4, 13),
                Tokens.Identifiers.FieldName("field", 4, 20),
                Tokens.Operators.Assignment(4, 26),
                Tokens.Puncuation.String.Begin(4, 28),
                Tokens.Literals.String("hello", 4, 29),
                Tokens.Puncuation.String.End(4, 34),
                Tokens.Puncuation.Semicolon(4, 35),

                Tokens.Keywords.Modifiers.Const(5, 5),
                Tokens.Type("bool", 5, 13),
                Tokens.Identifiers.FieldName("field", 5, 20),
                Tokens.Operators.Assignment(5, 26),
                Tokens.Literals.Boolean.True(5, 28),
                Tokens.Puncuation.Semicolon(5, 32),

                Tokens.Puncuation.CurlyBrace.Close(6, 1)]);
        });

        it("expression body", () => {

            // TODO: Make this a property rather a field. Also, 'const' isn't legal since this is actually a property.

            const input = `
public class Tester
{
    private string field => "hello";
    const   bool   field => true;
}`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Private(4, 5),
                Tokens.Type("string", 4, 13),
                Tokens.Identifiers.FieldName("field", 4, 20),
                Tokens.Operators.Arrow(4, 26),
                Tokens.Puncuation.String.Begin(4, 29),
                Tokens.Literals.String("hello", 4, 30),
                Tokens.Puncuation.String.End(4, 35),
                Tokens.Puncuation.Semicolon(4, 36),

                Tokens.Keywords.Modifiers.Const(5, 5),
                Tokens.Type("bool", 5, 13),
                Tokens.Identifiers.FieldName("field", 5, 20),
                Tokens.Operators.Arrow(5, 26),
                Tokens.Literals.Boolean.True(5, 29),
                Tokens.Puncuation.Semicolon(5, 33),

                Tokens.Puncuation.CurlyBrace.Close(6, 1)]);
        });
    });
});


