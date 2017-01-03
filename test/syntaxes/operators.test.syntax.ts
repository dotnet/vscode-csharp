/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Operators", () => {
        it("unary +", () => {

            const input = Input.InClass(`public static int operator +(int value) { return +value; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("+"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("value"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Operators.Arithmetic.Addition,
                Token.Variables.ReadWrite("value"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("unary -", () => {

            const input = Input.InClass(`public static int operator -(int value) { return -value; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("-"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("value"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Operators.Arithmetic.Subtraction,
                Token.Variables.ReadWrite("value"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("unary !", () => {

            const input = Input.InClass(`public static bool operator !(int value) { return value == 0; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("bool"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("!"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("value"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("value"),
                Token.Operators.Relational.Equals,
                Token.Literals.Numeric.Decimal("0"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("unary ~", () => {

            const input = Input.InClass(`public static int operator ~(int value) { return ~value; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("~"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("value"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Operators.Bitwise.BitwiseComplement,
                Token.Variables.ReadWrite("value"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("unary ++", () => {

            const input = Input.InClass(`public static int operator ++(int value) { return ++value; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("++"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("value"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Operators.Increment,
                Token.Variables.ReadWrite("value"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("unary --", () => {

            const input = Input.InClass(`public static int operator --(int value) { return --value; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("--"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("value"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Operators.Decrement,
                Token.Variables.ReadWrite("value"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("unary true", () => {

            const input = Input.InClass(`public static int operator true(int value) { return value != 0; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("true"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("value"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("value"),
                Token.Operators.Relational.NotEqual,
                Token.Literals.Numeric.Decimal("0"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("unary false", () => {

            const input = Input.InClass(`public static int operator false(int value) { return value == 0; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("false"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("value"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("value"),
                Token.Operators.Relational.Equals,
                Token.Literals.Numeric.Decimal("0"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary +", () => {

            const input = Input.InClass(`public static int operator +(int x, int y) { return x + y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("+"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Arithmetic.Addition,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary -", () => {

            const input = Input.InClass(`public static int operator -(int x, int y) { return x - y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("-"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Arithmetic.Subtraction,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary *", () => {

            const input = Input.InClass(`public static int operator *(int x, int y) { return x * y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("*"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Arithmetic.Multiplication,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary /", () => {

            const input = Input.InClass(`public static int operator /(int x, int y) { return x / y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("/"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Arithmetic.Division,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary %", () => {

            const input = Input.InClass(`public static int operator %(int x, int y) { return x % y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("%"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Arithmetic.Remainder,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary &", () => {

            const input = Input.InClass(`public static int operator &(int x, int y) { return x & y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("&"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Bitwise.And,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary |", () => {

            const input = Input.InClass(`public static int operator |(int x, int y) { return x | y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("|"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Bitwise.Or,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary ^", () => {

            const input = Input.InClass(`public static int operator ^(int x, int y) { return x ^ y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("^"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Bitwise.ExclusiveOr,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary <<", () => {

            const input = Input.InClass(`public static int operator <<(int x, int y) { return x << y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("<<"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Bitwise.ShiftLeft,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary >>", () => {

            const input = Input.InClass(`public static int operator >>(int x, int y) { return x >> y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName(">>"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Bitwise.ShiftRight,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary ==", () => {

            const input = Input.InClass(`public static bool operator ==(int x, int y) { return x == y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("bool"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("=="),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Relational.Equals,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary !=", () => {

            const input = Input.InClass(`public static bool operator !=(int x, int y) { return x != y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("bool"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("!="),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Relational.NotEqual,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary >", () => {

            const input = Input.InClass(`public static bool operator >(int x, int y) { return x > y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("bool"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName(">"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Relational.GreaterThan,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary <", () => {

            const input = Input.InClass(`public static bool operator <(int x, int y) { return x < y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("bool"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("<"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Relational.LessThan,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary >=", () => {

            const input = Input.InClass(`public static bool operator >=(int x, int y) { return x >= y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("bool"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName(">="),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Relational.GreaterThanOrEqual,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("binary <=", () => {

            const input = Input.InClass(`public static bool operator <=(int x, int y) { return x <= y; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("bool"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("<="),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Relational.LessThanOrEqual,
                Token.Variables.ReadWrite("y"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("implicit conversion", () => {

            const input = Input.InClass(`public static implicit operator bool(int x) { return x != 0; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Keywords.Implicit,
                Token.Keywords.Operator,
                Token.Type("bool"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Relational.NotEqual,
                Token.Literals.Numeric.Decimal("0"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("explicit conversion", () => {

            const input = Input.InClass(`public static explicit operator bool(int x) { return x != 0; }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Keywords.Explicit,
                Token.Keywords.Operator,
                Token.Type("bool"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.OpenBrace,
                Token.Keywords.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Relational.NotEqual,
                Token.Literals.Numeric.Decimal("0"),
                Token.Puncuation.Semicolon,
                Token.Puncuation.CloseBrace]);
        });

        it("with expression body", () => {

            const input = Input.InClass(`public static int operator +(int value) => +value;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Static,
                Token.Type("int"),
                Token.Keywords.Operator,
                Token.Identifiers.MethodName("+"),
                Token.Puncuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("value"),
                Token.Puncuation.CloseParen,
                Token.Operators.Arrow,
                Token.Operators.Arithmetic.Addition,
                Token.Variables.ReadWrite("value"),
                Token.Puncuation.Semicolon]);
        });
    });
});