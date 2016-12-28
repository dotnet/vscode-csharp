/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Events", () => {
        it("declaration", () => {

            const input = `
public class Tester
{
    public event Type Event;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Event,
                Tokens.Type("Type"),
                Tokens.Identifiers.EventName("Event"),
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("declaration with multiple modifiers", () => {

            const input = `
public class Tester
{
    protected internal event Type Event;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Modifiers.Protected,
                Tokens.Keywords.Modifiers.Internal,
                Tokens.Keywords.Event,
                Tokens.Type("Type"),
                Tokens.Identifiers.EventName("Event"),
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("declaration with multiple declarators", () => {

            const input = `
public class Tester
{
    public event Type Event1, Event2;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Event,
                Tokens.Type("Type"),
                Tokens.Identifiers.EventName("Event1"),
                Tokens.Puncuation.Comma,
                Tokens.Identifiers.EventName("Event2"),
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("generic", () => {

            const input = `
public class Tester
{
    public event EventHandler<List<T>, Dictionary<T, D>> Event;
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Event,
                Tokens.Type("EventHandler"),
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
                Tokens.Identifiers.EventName("Event"),
                Tokens.Puncuation.Semicolon,

                Tokens.Puncuation.CurlyBrace.Close]);
        });

        it("declaration with accessors", () => {

            const input = `
public class Tester
{
    public event Type Event
    {
        add { }
        remove { }
    }
}`;

            let tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Class,
                Tokens.Identifiers.ClassName("Tester"),
                Tokens.Puncuation.CurlyBrace.Open,

                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Event,
                Tokens.Type("Type"),
                Tokens.Identifiers.EventName("Event"),
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Keywords.Add,
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,
                Tokens.Keywords.Remove,
                Tokens.Puncuation.CurlyBrace.Open,
                Tokens.Puncuation.CurlyBrace.Close,
                Tokens.Puncuation.CurlyBrace.Close,

                Tokens.Puncuation.CurlyBrace.Close]);
        });
    });
});