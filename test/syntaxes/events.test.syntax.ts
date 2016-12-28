/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Tokens } from './utils/tokenizer';

describe("Grammar", () => {
    before(() => should());

    describe("Events", () => {
        it("declaration", () => {

            const input = Input.InClass(`public event Type Event;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Event,
                Tokens.Type("Type"),
                Tokens.Identifiers.EventName("Event"),
                Tokens.Puncuation.Semicolon]);
        });

        it("declaration with multiple modifiers", () => {

            const input = Input.InClass(`protected internal event Type Event;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Protected,
                Tokens.Keywords.Modifiers.Internal,
                Tokens.Keywords.Event,
                Tokens.Type("Type"),
                Tokens.Identifiers.EventName("Event"),
                Tokens.Puncuation.Semicolon]);
        });

        it("declaration with multiple declarators", () => {

            const input = Input.InClass(`public event Type Event1, Event2;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public,
                Tokens.Keywords.Event,
                Tokens.Type("Type"),
                Tokens.Identifiers.EventName("Event1"),
                Tokens.Puncuation.Comma,
                Tokens.Identifiers.EventName("Event2"),
                Tokens.Puncuation.Semicolon]);
        });

        it("generic", () => {

            const input = Input.InClass(`public event EventHandler<List<T>, Dictionary<T, D>> Event;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
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
                Tokens.Puncuation.Semicolon]);
        });

        it("declaration with accessors", () => {

            const input = Input.InClass(`
public event Type Event
{
    add { }
    remove { }
}`);

            const tokens = tokenize(input);

            tokens.should.deep.equal([
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
                Tokens.Puncuation.CurlyBrace.Close]);
        });
    });
});