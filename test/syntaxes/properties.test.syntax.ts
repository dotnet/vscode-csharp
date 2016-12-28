/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { Tokens } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

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
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("Tester", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Public(4, 5),
                Tokens.Type("IBooom", 4, 12),
                Tokens.Identifiers.PropertyName("Property", 4, 19),
                Tokens.Puncuation.CurlyBrace.Open(5, 5),
                Tokens.Keywords.Get(6, 9),
                Tokens.Puncuation.CurlyBrace.Open(6, 13),
                Tokens.Puncuation.Semicolon(6, 26),
                Tokens.Puncuation.CurlyBrace.Close(6, 28),
                Tokens.Keywords.Set(7, 9),
                Tokens.Puncuation.CurlyBrace.Open(7, 13),
                Tokens.Puncuation.Semicolon(7, 32),
                Tokens.Puncuation.CurlyBrace.Close(7, 34),
                Tokens.Puncuation.CurlyBrace.Close(8, 5),

                Tokens.Puncuation.CurlyBrace.Close(9, 1)]);
        });

        it("declaration single line", () => {

            const input = `
class Tester
{
    public IBooom Property { get { return null; } private set { something = value; } }
}`;
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("Tester", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Public(4, 5),
                Tokens.Type("IBooom", 4, 12),
                Tokens.Identifiers.PropertyName("Property", 4, 19),
                Tokens.Puncuation.CurlyBrace.Open(4, 28),
                Tokens.Keywords.Get(4, 30),
                Tokens.Puncuation.CurlyBrace.Open(4, 34),
                Tokens.Puncuation.Semicolon(4, 47),
                Tokens.Puncuation.CurlyBrace.Close(4, 49),
                Tokens.Keywords.Modifiers.Private(4, 51),
                Tokens.Keywords.Set(4, 59),
                Tokens.Puncuation.CurlyBrace.Open(4, 63),
                Tokens.Puncuation.Semicolon(4, 82),
                Tokens.Puncuation.CurlyBrace.Close(4, 84),
                Tokens.Puncuation.CurlyBrace.Close(4, 86),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
        });

        it("declaration without modifiers", () => {

            const input = `
class Tester
{
    IBooom Property {get; set;}
}`;
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("Tester", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Type("IBooom", 4, 5),
                Tokens.Identifiers.PropertyName("Property", 4, 12),
                Tokens.Puncuation.CurlyBrace.Open(4, 21),
                Tokens.Keywords.Get(4, 22),
                Tokens.Puncuation.Semicolon(4, 25),
                Tokens.Keywords.Set(4, 27),
                Tokens.Puncuation.Semicolon(4, 30),
                Tokens.Puncuation.CurlyBrace.Close(4, 31),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
        });

        it("auto-property single line", function () {

            const input = `
class Tester
{
    public IBooom Property { get; set; }
}`;
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("Tester", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Public(4, 5),
                Tokens.Type("IBooom", 4, 12),
                Tokens.Identifiers.PropertyName("Property", 4, 19),
                Tokens.Puncuation.CurlyBrace.Open(4, 28),
                Tokens.Keywords.Get(4, 30),
                Tokens.Puncuation.Semicolon(4, 33),
                Tokens.Keywords.Set(4, 35),
                Tokens.Puncuation.Semicolon(4, 38),
                Tokens.Puncuation.CurlyBrace.Close(4, 40),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
        });

        it("auto-property single line (protected internal)", function () {

            const input = `
class Tester
{
    protected internal IBooom Property { get; set; }
}`;
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("Tester", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Protected(4, 5),
                Tokens.Keywords.Modifiers.Internal(4, 15),
                Tokens.Type("IBooom", 4, 24),
                Tokens.Identifiers.PropertyName("Property", 4, 31),
                Tokens.Puncuation.CurlyBrace.Open(4, 40),
                Tokens.Keywords.Get(4, 42),
                Tokens.Puncuation.Semicolon(4, 45),
                Tokens.Keywords.Set(4, 47),
                Tokens.Puncuation.Semicolon(4, 50),
                Tokens.Puncuation.CurlyBrace.Close(4, 52),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
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
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("Tester", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Public(4, 5),
                Tokens.Type("IBooom", 4, 12),
                Tokens.Identifiers.PropertyName("Property", 4, 19),
                Tokens.Puncuation.CurlyBrace.Open(5, 5),
                Tokens.Keywords.Get(6, 9),
                Tokens.Puncuation.Semicolon(6, 12),
                Tokens.Keywords.Set(7, 9),
                Tokens.Puncuation.Semicolon(7, 12),
                Tokens.Puncuation.CurlyBrace.Close(8, 5),

                Tokens.Puncuation.CurlyBrace.Close(9, 1)]);
        });

        it("generic auto-property", () => {

            const input = `
class Tester
{
    public Dictionary<string, List<T>[]> Property { get; set; }
}`;
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("Tester", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Public(4, 5),
                Tokens.Type("Dictionary", 4, 12),
                Tokens.Puncuation.TypeParameters.Begin(4, 22),
                Tokens.Type("string", 4, 23),
                Tokens.Puncuation.Comma(4, 29),
                Tokens.Type("List", 4, 31),
                Tokens.Puncuation.TypeParameters.Begin(4, 35),
                Tokens.Type("T", 4, 36),
                Tokens.Puncuation.TypeParameters.End(4, 37),
                Tokens.Puncuation.SquareBracket.Open(4, 38),
                Tokens.Puncuation.SquareBracket.Close(4, 39),
                Tokens.Puncuation.TypeParameters.End(4, 40),
                Tokens.Identifiers.PropertyName("Property", 4, 42),
                Tokens.Puncuation.CurlyBrace.Open(4, 51),
                Tokens.Keywords.Get(4, 53),
                Tokens.Puncuation.Semicolon(4, 56),
                Tokens.Keywords.Set(4, 58),
                Tokens.Puncuation.Semicolon(4, 61),
                Tokens.Puncuation.CurlyBrace.Close(4, 63),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
        });

        it("auto-property initializer", () => {

            const input = `
class Tester
{
    public Dictionary<string, List<T>[]> Property { get; } = new Dictionary<string, List<T>[]>();
}`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Class(2, 1),
                Tokens.Identifiers.ClassName("Tester", 2, 7),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Public(4, 5),
                Tokens.Type("Dictionary", 4, 12),
                Tokens.Puncuation.TypeParameters.Begin(4, 22),
                Tokens.Type("string", 4, 23),
                Tokens.Puncuation.Comma(4, 29),
                Tokens.Type("List", 4, 31),
                Tokens.Puncuation.TypeParameters.Begin(4, 35),
                Tokens.Type("T", 4, 36),
                Tokens.Puncuation.TypeParameters.End(4, 37),
                Tokens.Puncuation.SquareBracket.Open(4, 38),
                Tokens.Puncuation.SquareBracket.Close(4, 39),
                Tokens.Puncuation.TypeParameters.End(4, 40),
                Tokens.Identifiers.PropertyName("Property", 4, 42),
                Tokens.Puncuation.CurlyBrace.Open(4, 51),
                Tokens.Keywords.Get(4, 53),
                Tokens.Puncuation.Semicolon(4, 56),
                Tokens.Puncuation.CurlyBrace.Close(4, 58),
                Tokens.Operators.Assignment(4, 60),
                Tokens.Keywords.New(4, 62),
                Tokens.Type("Dictionary", 4, 66),
                Tokens.Puncuation.TypeParameters.Begin(4, 76),
                Tokens.Type("string", 4, 77),
                Tokens.Puncuation.Comma(4, 83),
                Tokens.Type("List", 4, 85),
                Tokens.Puncuation.TypeParameters.Begin(4, 89),
                Tokens.Type("T", 4, 90),
                Tokens.Puncuation.TypeParameters.End(4, 91),
                Tokens.Puncuation.SquareBracket.Open(4, 92),
                Tokens.Puncuation.SquareBracket.Close(4, 93),
                Tokens.Puncuation.TypeParameters.End(4, 94),
                Tokens.Puncuation.Parenthesis.Open(4, 95),
                Tokens.Puncuation.Parenthesis.Close(4, 96),
                Tokens.Puncuation.Semicolon(4, 97),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
        });

        it("expression body", () => {

            const input = `
public class Tester
{
    private string prop1 => "hello";
    private bool   prop2 => true;
}`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Private(4, 5),
                Tokens.Type("string", 4, 13),
                Tokens.Identifiers.PropertyName("prop1", 4, 20),
                Tokens.Operators.Arrow(4, 26),
                Tokens.Puncuation.String.Begin(4, 29),
                Tokens.Literals.String("hello", 4, 30),
                Tokens.Puncuation.String.End(4, 35),
                Tokens.Puncuation.Semicolon(4, 36),

                Tokens.Keywords.Modifiers.Private(5, 5),
                Tokens.Type("bool", 5, 13),
                Tokens.Identifiers.PropertyName("prop2", 5, 20),
                Tokens.Operators.Arrow(5, 26),
                Tokens.Literals.Boolean.True(5, 29),
                Tokens.Puncuation.Semicolon(5, 33),

                Tokens.Puncuation.CurlyBrace.Close(6, 1)]);
        });
    });
});
