/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { Tokens } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => should());

    describe("Events", () => {
        it("declaration", () => {

            const input = `
public class Tester
{
    public event Type Event;
}`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Public(4, 5),
                Tokens.Keywords.Event(4, 12),
                Tokens.Type("Type", 4, 18),
                Tokens.Identifiers.EventName("Event", 4, 23),
                Tokens.Puncuation.Semicolon(4, 28),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
        });

        it("declaration with multiple modifiers", () => {

            const input = `
public class Tester
{
    protected internal event Type Event;
}`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Protected(4, 5),
                Tokens.Keywords.Modifiers.Internal(4, 15),
                Tokens.Keywords.Event(4, 24),
                Tokens.Type("Type", 4, 30),
                Tokens.Identifiers.EventName("Event", 4, 35),
                Tokens.Puncuation.Semicolon(4, 40),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
        });

        it("declaration with multiple declarators", () => {

            const input = `
public class Tester
{
    public event Type Event1, Event2;
}`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Public(4, 5),
                Tokens.Keywords.Event(4, 12),
                Tokens.Type("Type", 4, 18),
                Tokens.Identifiers.EventName("Event1", 4, 23),
                Tokens.Puncuation.Comma(4, 29),
                Tokens.Identifiers.EventName("Event2", 4, 31),
                Tokens.Puncuation.Semicolon(4, 37),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
        });

        it("generic", () => {

            const input = `
public class Tester
{
    public event EventHandler<List<T>, Dictionary<T, D>> Event;
}`;

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Public(4, 5),
                Tokens.Keywords.Event(4, 12),
                Tokens.Type("EventHandler", 4, 18),
                Tokens.Puncuation.TypeParameters.Begin(4, 30),
                Tokens.Type("List", 4, 31),
                Tokens.Puncuation.TypeParameters.Begin(4, 35),
                Tokens.Type("T", 4, 36),
                Tokens.Puncuation.TypeParameters.End(4, 37),
                Tokens.Puncuation.Comma(4, 38),
                Tokens.Type("Dictionary", 4, 40),
                Tokens.Puncuation.TypeParameters.Begin(4, 50),
                Tokens.Type("T", 4, 51),
                Tokens.Puncuation.Comma(4, 52),
                Tokens.Type("D", 4, 54),
                Tokens.Puncuation.TypeParameters.End(4, 55),
                Tokens.Puncuation.TypeParameters.End(4, 56),
                Tokens.Identifiers.EventName("Event", 4, 58),
                Tokens.Puncuation.Semicolon(4, 63),

                Tokens.Puncuation.CurlyBrace.Close(5, 1)]);
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

            let tokens = TokenizerUtil.tokenize2(input);

            tokens.should.deep.equal([
                Tokens.Keywords.Modifiers.Public(2, 1),
                Tokens.Keywords.Class(2, 8),
                Tokens.Identifiers.ClassName("Tester", 2, 14),
                Tokens.Puncuation.CurlyBrace.Open(3, 1),

                Tokens.Keywords.Modifiers.Public(4, 5),
                Tokens.Keywords.Event(4, 12),
                Tokens.Type("Type", 4, 18),
                Tokens.Identifiers.EventName("Event", 4, 23),
                Tokens.Puncuation.CurlyBrace.Open(5, 5),
                Tokens.Keywords.Add(6, 9),
                Tokens.Puncuation.CurlyBrace.Open(6, 13),
                Tokens.Puncuation.CurlyBrace.Close(6, 15),
                Tokens.Keywords.Remove(7, 9),
                Tokens.Puncuation.CurlyBrace.Open(7, 16),
                Tokens.Puncuation.CurlyBrace.Close(7, 18),
                Tokens.Puncuation.CurlyBrace.Close(8, 5),

                Tokens.Puncuation.CurlyBrace.Close(9, 1)]);
        });
    });
});


