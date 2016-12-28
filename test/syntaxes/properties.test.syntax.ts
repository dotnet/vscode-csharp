/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Property", () => {
        it("declaration", () => {

            const input = `
class Tester
{
    public IBooom Property
    {
        get { return null; }
        set { something = value; }
    }
}`;
            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Modifiers.Public,
                Tokens.Type("IBooom"),
                Tokens.Identifiers.PropertyName("Property"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Keywords.Get,
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Keywords.Return,
                Tokens.Literals.Null,
                Tokens.Puncuation.Semicolon,
                Tokens.Puncuation.CurlyBrace.Close,
                Tokens.Keywords.Set,
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Variables.ReadWrite("something"),
                Tokens.Operators.Assignment,
                Tokens.Variables.ReadWrite("value"),
                Tokens.Puncuation.Semicolon,
                Tokens.Puncuation.CurlyBrace.Close,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("declaration single line", () => {

            const input = `
class Tester
{
    public IBooom Property { get { return null; } private set { something = value; } }
}`;
            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Modifiers.Public,
                Tokens.Type("IBooom"),
                Tokens.Identifiers.PropertyName("Property"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Keywords.Get,
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Keywords.Return,
                Tokens.Literals.Null,
                Tokens.Puncuation.Semicolon,
                Tokens.Puncuation.CurlyBrace.Close,
                Tokens.Keywords.Modifiers.Private,
                Tokens.Keywords.Set,
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Variables.ReadWrite("something"),
                Tokens.Operators.Assignment,
                Tokens.Variables.ReadWrite("value"),
                Tokens.Puncuation.Semicolon,
                Tokens.Puncuation.CurlyBrace.Close,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("declaration without modifiers", () => {

            const input = `
class Tester
{
    IBooom Property {get; set;}
}`;
            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Type("IBooom"),
                Tokens.Identifiers.PropertyName("Property"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Keywords.Get,
                Tokens.Puncuation.Semicolon,
                Tokens.Keywords.Set,
                Tokens.Puncuation.Semicolon,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("auto-property single line", function () {

            const input = `
class Tester
{
    public IBooom Property { get; set; }
}`;
            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Modifiers.Public,
                Tokens.Type("IBooom"),
                Tokens.Identifiers.PropertyName("Property"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Keywords.Get,
                Tokens.Puncuation.Semicolon,
                Tokens.Keywords.Set,
                Tokens.Puncuation.Semicolon,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("auto-property single line (protected internal)", function () {

            const input = `
class Tester
{
    protected internal IBooom Property { get; set; }
}`;
            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Modifiers.Protected,
                Tokens.Keywords.Modifiers.Internal,
                Tokens.Type("IBooom"),
                Tokens.Identifiers.PropertyName("Property"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Keywords.Get,
                Tokens.Puncuation.Semicolon,
                Tokens.Keywords.Set,
                Tokens.Puncuation.Semicolon,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("auto-property", () => {

            const input = `
class Tester
{
    public IBooom Property
    {
        get;
        set;
    }
}`;
            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Modifiers.Public,
                Tokens.Type("IBooom"),
                Tokens.Identifiers.PropertyName("Property"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Keywords.Get,
                Tokens.Puncuation.Semicolon,
                Tokens.Keywords.Set,
                Tokens.Puncuation.Semicolon,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("generic auto-property", () => {

            const input = `
class Tester
{
    public Dictionary<string, List<T>[]> Property { get; set; }
}`;
            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Modifiers.Public,
                Tokens.Type("Dictionary"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("string"),
                Tokens.Puncuation.Comma,
                Tokens.Type("List"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("T"),
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Puncuation.SquareBracket.Close,
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Identifiers.PropertyName("Property"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Keywords.Get,
                Tokens.Puncuation.Semicolon,
                Tokens.Keywords.Set,
                Tokens.Puncuation.Semicolon,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("auto-property initializer", () => {

            const input = `
class Tester
{
    public Dictionary<string, List<T>[]> Property { get; } = new Dictionary<string, List<T>[]>();
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Modifiers.Public,
                Tokens.Type("Dictionary"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("string"),
                Tokens.Puncuation.Comma,
                Tokens.Type("List"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("T"),
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Puncuation.SquareBracket.Close,
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Identifiers.PropertyName("Property"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Keywords.Get,
                Tokens.Puncuation.Semicolon,
                Tokens.Puncuation.CurlyBrace.Close,
                Tokens.Operators.Assignment,
                Tokens.Keywords.New,
                Tokens.Type("Dictionary"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("string"),
                Tokens.Puncuation.Comma,
                Tokens.Type("List"),
                Tokens.Puncuation.TypeParameters.Begin,
                Tokens.Type("T"),
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.SquareBracket.Open,
                Tokens.Puncuation.SquareBracket.Close,
                Tokens.Puncuation.TypeParameters.End,
                Tokens.Puncuation.Parenthesis.Open,
                Tokens.Puncuation.Parenthesis.Close,
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("expression body", () => {

            const input = `
public class Tester
{
    private string prop1 => "hello";
    private bool   prop2 => true;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Modifiers.Private,
                Tokens.Type("string"),
                Tokens.Identifiers.PropertyName("prop1"),
                Tokens.Operators.Arrow,
                Tokens.Puncuation.String.Begin,
                Tokens.Literals.String("hello"),
                Tokens.Puncuation.String.End,
                Tokens.Puncuation.Semicolon,

                Tokens.Keywords.Modifiers.Private,
                Tokens.Type("bool"),
                Tokens.Identifiers.PropertyName("prop2"),
                Tokens.Operators.Arrow,
                Tokens.Literals.Boolean.True,
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });
    });
});