/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Anonymous method expressions", () => {
        it("lambda expression with no parameters (assignment)", () => {
            const input = Input.InMethod(`Action a = () => { };`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("Action"),
                Token.Variables.Local("a"),
                Token.Operators.Assignment,
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.Semicolon
            ]);
        });

        it("async lambda expression with no parameters (assignment)", () => {
            const input = Input.InMethod(`Func<Task> a = async () => { };`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("Func"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("Task"),
                Token.Punctuation.TypeParameters.End,
                Token.Variables.Local("a"),
                Token.Operators.Assignment,
                Token.Keywords.Modifiers.Async,
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.Semicolon
            ]);
        });

        it("lambda expression with single parameter (assignment)", () => {
            const input = Input.InMethod(`Action<int> a = x => { };`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("Action"),
                Token.Punctuation.TypeParameters.Begin,
                Token.PrimitiveType.Int,
                Token.Punctuation.TypeParameters.End,
                Token.Variables.Local("a"),
                Token.Operators.Assignment,
                Token.Variables.Parameter("x"),
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.Semicolon
            ]);
        });

        it("async lambda expression with single parameter (assignment)", () => {
            const input = Input.InMethod(`Func<int, Task> a = async x => { };`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("Func"),
                Token.Punctuation.TypeParameters.Begin,
                Token.PrimitiveType.Int,
                Token.Punctuation.Comma,
                Token.Type("Task"),
                Token.Punctuation.TypeParameters.End,
                Token.Variables.Local("a"),
                Token.Operators.Assignment,
                Token.Keywords.Modifiers.Async,
                Token.Variables.Parameter("x"),
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.Semicolon
            ]);
        });

        it("lambda expression with single typed parameter (assignment)", () => {
            const input = Input.InMethod(`Action<int> a = (int x) => { };`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("Action"),
                Token.Punctuation.TypeParameters.Begin,
                Token.PrimitiveType.Int,
                Token.Punctuation.TypeParameters.End,
                Token.Variables.Local("a"),
                Token.Operators.Assignment,
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.Int,
                Token.Variables.Parameter("x"),
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.Semicolon
            ]);
        });

        it("async lambda expression with single typed parameter (assignment)", () => {
            const input = Input.InMethod(`Func<int, Task> a = async (int x) => { };`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("Func"),
                Token.Punctuation.TypeParameters.Begin,
                Token.PrimitiveType.Int,
                Token.Punctuation.Comma,
                Token.Type("Task"),
                Token.Punctuation.TypeParameters.End,
                Token.Variables.Local("a"),
                Token.Operators.Assignment,
                Token.Keywords.Modifiers.Async,
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.Int,
                Token.Variables.Parameter("x"),
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.Semicolon
            ]);
        });

        it("lambda expression with multiple typed parameters (assignment)", () => {
            const input = Input.InMethod(`Action<int, int> a = (int x, int y) => { };`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("Action"),
                Token.Punctuation.TypeParameters.Begin,
                Token.PrimitiveType.Int,
                Token.Punctuation.Comma,
                Token.PrimitiveType.Int,
                Token.Punctuation.TypeParameters.End,
                Token.Variables.Local("a"),
                Token.Operators.Assignment,
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.Int,
                Token.Variables.Parameter("x"),
                Token.Punctuation.Comma,
                Token.PrimitiveType.Int,
                Token.Variables.Parameter("y"),
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.Semicolon
            ]);
        });

        it("async lambda expression with multiple typed parameters (assignment)", () => {
            const input = Input.InMethod(`Func<int, int, Task> a = async (int x, int y) => { };`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("Func"),
                Token.Punctuation.TypeParameters.Begin,
                Token.PrimitiveType.Int,
                Token.Punctuation.Comma,
                Token.PrimitiveType.Int,
                Token.Punctuation.Comma,
                Token.Type("Task"),
                Token.Punctuation.TypeParameters.End,
                Token.Variables.Local("a"),
                Token.Operators.Assignment,
                Token.Keywords.Modifiers.Async,
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.Int,
                Token.Variables.Parameter("x"),
                Token.Punctuation.Comma,
                Token.PrimitiveType.Int,
                Token.Variables.Parameter("y"),
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.Semicolon
            ]);
        });

        it("lambda expression with no parameters (passed as argument)", () => {
            const input = Input.InMethod(`M(() => { });`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("async lambda expression with no parameters (passed as argument)", () => {
            const input = Input.InMethod(`M(async () => { });`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Punctuation.OpenParen,
                Token.Keywords.Modifiers.Async,
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("lambda expression with single parameter (passed as argument)", () => {
            const input = Input.InMethod(`M(x => { });`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Punctuation.OpenParen,
                Token.Variables.Parameter("x"),
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("async lambda expression with single parameter (passed as argument)", () => {
            const input = Input.InMethod(`M(async x => { });`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Punctuation.OpenParen,
                Token.Keywords.Modifiers.Async,
                Token.Variables.Parameter("x"),
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("lambda expression with single typed parameter (passed as argument)", () => {
            const input = Input.InMethod(`M((int x) => { });`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.Int,
                Token.Variables.Parameter("x"),
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("async lambda expression with single typed parameter (passed as argument)", () => {
            const input = Input.InMethod(`M(async (int x) => { });`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Punctuation.OpenParen,
                Token.Keywords.Modifiers.Async,
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.Int,
                Token.Variables.Parameter("x"),
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("lambda expression with multiple typed parameters (passed as argument)", () => {
            const input = Input.InMethod(`M((int x, int y) => { });`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.Int,
                Token.Variables.Parameter("x"),
                Token.Punctuation.Comma,
                Token.PrimitiveType.Int,
                Token.Variables.Parameter("y"),
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });

        it("async lambda expression with multiple typed parameters (passed as argument)", () => {
            const input = Input.InMethod(`M(async (int x, int y) => { });`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Punctuation.OpenParen,
                Token.Keywords.Modifiers.Async,
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.Int,
                Token.Variables.Parameter("x"),
                Token.Punctuation.Comma,
                Token.PrimitiveType.Int,
                Token.Variables.Parameter("y"),
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon
            ]);
        });
    });
});