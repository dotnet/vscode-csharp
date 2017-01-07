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
                Token.Punctuation.Semicolon]);
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
                Token.Punctuation.Semicolon]);
        });

        it("declaration with multiple declarators", () => {

            const input = Input.InClass(`public event Type Event1, Event2;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Event,
                Token.Type("Type"),
                Token.Identifiers.EventName("Event1"),
                Token.Punctuation.Comma,
                Token.Identifiers.EventName("Event2"),
                Token.Punctuation.Semicolon]);
        });

        it("generic", () => {

            const input = Input.InClass(`public event EventHandler<List<T>, Dictionary<T, D>> Event;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Event,
                Token.Type("EventHandler"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("List"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.Comma,
                Token.Type("Dictionary"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Punctuation.Comma,
                Token.Type("D"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.TypeParameters.End,
                Token.Identifiers.EventName("Event"),
                Token.Punctuation.Semicolon]);
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
                Token.Punctuation.OpenBrace,
                Token.Keywords.Add,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Remove,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("explicitly-implemented interface member", () => {

            const input = Input.InClass(`event EventHandler IFoo<string>.Event { add; remove; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Event,
                Token.Type("EventHandler"),
                Token.Type("IFoo"),
                Token.Punctuation.TypeParameters.Begin,
                Token.PrimitiveType.String,
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.Accessor,
                Token.Identifiers.EventName("Event"),
                Token.Punctuation.OpenBrace,
                Token.Keywords.Add,
                Token.Punctuation.Semicolon,
                Token.Keywords.Remove,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace]);
        });

        it("declaration in interface", () => {

            const input = Input.InInterface(`event EventHandler Event;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Event,
                Token.Type("EventHandler"),
                Token.Identifiers.EventName("Event"),
                Token.Punctuation.Semicolon]);
        });
    });
});