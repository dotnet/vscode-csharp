/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Events", () => {
        it("declaration", () => {

            const input = Input.InClass(`public event Type Event;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Event,
                Token.Type("Type"),
                Token.Identifiers.EventName("Event"),
                Token.Puncuation.Semicolon]);
        });

        it("declaration with multiple modifiers", () => {

            const input = Input.InClass(`protected internal event Type Event;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Protected,
                Token.Keywords.Modifiers.Internal,
                Token.Keywords.Event,
                Token.Type("Type"),
                Token.Identifiers.EventName("Event"),
                Token.Puncuation.Semicolon]);
        });

        it("declaration with multiple declarators", () => {

            const input = Input.InClass(`public event Type Event1, Event2;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Event,
                Token.Type("Type"),
                Token.Identifiers.EventName("Event1"),
                Token.Puncuation.Comma,
                Token.Identifiers.EventName("Event2"),
                Token.Puncuation.Semicolon]);
        });

        it("generic", () => {

            const input = Input.InClass(`public event EventHandler<List<T>, Dictionary<T, D>> Event;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Event,
                Token.Type("EventHandler"),
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
                Token.Identifiers.EventName("Event"),
                Token.Puncuation.Semicolon]);
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
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Event,
                Token.Type("Type"),
                Token.Identifiers.EventName("Event"),
                Token.Puncuation.OpenBrace,
                Token.Keywords.Add,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,
                Token.Keywords.Remove,
                Token.Puncuation.OpenBrace,
                Token.Puncuation.CloseBrace,
                Token.Puncuation.CloseBrace]);
        });

        it("explicitly-implemented interface member", () => {

            const input = Input.InClass(`event EventHandler IFoo<string>.Event { add; remove; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Event,
                Token.Type("EventHandler"),
                Token.Type("IFoo"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("string"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.Accessor,
                Token.Identifiers.EventName("Event"),
                Token.Puncuation.OpenBrace,
                Token.Keywords.Add,
                Token.Puncuation.Semicolon,
                Token.Keywords.Remove,
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("declaration in interface", () => {

            const input = Input.InInterface(`event EventHandler Event;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Event,
                Token.Type("EventHandler"),
                Token.Identifiers.EventName("Event"),
                Token.Puncuation.Semicolon]);
        });
    });
});