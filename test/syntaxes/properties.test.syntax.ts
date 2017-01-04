/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Property", () => {
        it("declaration", () => {

            const input = Input.InClass(`
public IBooom Property
{
    get { return null; }
    set { something = value; }
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Type("IBooom"),
                Token.Identifiers.PropertyName("Property"),
                Token.Puncuation.OpenBrace,
                Token.Keywords.Get,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Literals.Null,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace,
                Token.Keywords.Set,
                Token.Puncuation.OpenBrace,
                Token.Variables.ReadWrite("something"),
                Token.Operators.Assignment,
                Token.Variables.ReadWrite("value"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace,
                Token.Puncuation.CloseBrace]);
        });

        it("declaration single line", () => {

            const input = Input.InClass(`public IBooom Property { get { return null; } private set { something = value; } }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Type("IBooom"),
                Token.Identifiers.PropertyName("Property"),
                Token.Puncuation.OpenBrace,
                Token.Keywords.Get,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Literals.Null,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace,
                Token.Keywords.Modifiers.Private,
                Token.Keywords.Set,
                Token.Puncuation.OpenBrace,
                Token.Variables.ReadWrite("something"),
                Token.Operators.Assignment,
                Token.Variables.ReadWrite("value"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace,
                Token.Puncuation.CloseBrace]);
        });

        it("declaration without modifiers", () => {

            const input = Input.InClass(`IBooom Property {get; set;}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("IBooom"),
                Token.Identifiers.PropertyName("Property"),
                Token.Puncuation.OpenBrace,
                Token.Keywords.Get,
                Token.Puncuation.Semicolon,
                Token.Keywords.Set,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("auto-property single line", function () {

            const input = Input.InClass(`public IBooom Property { get; set; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Type("IBooom"),
                Token.Identifiers.PropertyName("Property"),
                Token.Puncuation.OpenBrace,
                Token.Keywords.Get,
                Token.Puncuation.Semicolon,
                Token.Keywords.Set,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("auto-property single line (protected internal)", function () {

            const input = Input.InClass(`protected internal IBooom Property { get; set; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Protected,
                Token.Keywords.Modifiers.Internal,
                Token.Type("IBooom"),
                Token.Identifiers.PropertyName("Property"),
                Token.Puncuation.OpenBrace,
                Token.Keywords.Get,
                Token.Puncuation.Semicolon,
                Token.Keywords.Set,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("auto-property", () => {

            const input = Input.InClass(`
public IBooom Property
{
    get;
    set;
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Type("IBooom"),
                Token.Identifiers.PropertyName("Property"),
                Token.Puncuation.OpenBrace,
                Token.Keywords.Get,
                Token.Puncuation.Semicolon,
                Token.Keywords.Set,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("generic auto-property", () => {

            const input = Input.InClass(`public Dictionary<string, List<T>[]> Property { get; set; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Type("Dictionary"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("string"),
                Token.Puncuation.Comma,
                Token.Type("List"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.OpenBracket,
                Token.Puncuation.CloseBracket,
                Token.Puncuation.TypeParameters.End,
                Token.Identifiers.PropertyName("Property"),
                Token.Puncuation.OpenBrace,
                Token.Keywords.Get,
                Token.Puncuation.Semicolon,
                Token.Keywords.Set,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("auto-property initializer", () => {

            const input = Input.InClass(`public Dictionary<string, List<T>[]> Property { get; } = new Dictionary<string, List<T>[]>();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Type("Dictionary"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("string"),
                Token.Puncuation.Comma,
                Token.Type("List"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.OpenBracket,
                Token.Puncuation.CloseBracket,
                Token.Puncuation.TypeParameters.End,
                Token.Identifiers.PropertyName("Property"),
                Token.Puncuation.OpenBrace,
                Token.Keywords.Get,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace,
                Token.Operators.Assignment,
                Token.Keywords.New,
                Token.Type("Dictionary"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("string"),
                Token.Puncuation.Comma,
                Token.Type("List"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.OpenBracket,
                Token.Puncuation.CloseBracket,
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon]);
        });

        it("expression body", () => {

            const input = Input.InClass(`
private string prop1 => "hello";
private bool   prop2 => true;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Private,
                Token.Type("string"),
                Token.Identifiers.PropertyName("prop1"),
                Token.Operators.Arrow,
                Token.Puncuation.String.Begin,
                Token.Literals.String("hello"),
                Token.Puncuation.String.End,
                Token.Puncuation.Semicolon,

                Token.Keywords.Modifiers.Private,
                Token.Type("bool"),
                Token.Identifiers.PropertyName("prop2"),
                Token.Operators.Arrow,
                Token.Literals.Boolean.True,
                Token.Puncuation.Semicolon]);
        });

        it("explicitly-implemented interface member", () => {

            const input = Input.InClass(`string IFoo<string>.Bar { get; set; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Type("IFoo"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("string"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.Accessor,
                Token.Identifiers.PropertyName("Bar"),
                Token.Puncuation.OpenBrace,
                Token.Keywords.Get,
                Token.Puncuation.Semicolon,
                Token.Keywords.Set,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("declaration in interface", () => {

            const input = Input.InInterface(`string Bar { get; set; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Identifiers.PropertyName("Bar"),
                Token.Puncuation.OpenBrace,
                Token.Keywords.Get,
                Token.Puncuation.Semicolon,
                Token.Keywords.Set,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("declaration in interface (read-only)", () => {

            const input = Input.InInterface(`string Bar { get; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Identifiers.PropertyName("Bar"),
                Token.Puncuation.OpenBrace,
                Token.Keywords.Get,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("declaration in interface (write-only)", () => {

            const input = Input.InInterface(`string Bar { set; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Identifiers.PropertyName("Bar"),
                Token.Puncuation.OpenBrace,
                Token.Keywords.Set,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });
    });
});