/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Invocation expressions", () => {
        it("no arguments", () => {
            const input = Input.InMethod(`M();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("one argument", () => {
            const input = Input.InMethod(`M(42);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Puncuation.OpenParen,
                Token.Literals.Numeric.Decimal("42"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("two arguments", () => {
            const input = Input.InMethod(`M(19, 23);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Puncuation.OpenParen,
                Token.Literals.Numeric.Decimal("19"),
                Token.Puncuation.Comma,
                Token.Literals.Numeric.Decimal("23"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("two named arguments", () => {
            const input = Input.InMethod(`M(x: 19, y: 23);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Puncuation.OpenParen,
                Token.Variables.Parameter("x"),
                Token.Puncuation.Colon,
                Token.Literals.Numeric.Decimal("19"),
                Token.Puncuation.Comma,
                Token.Variables.Parameter("y"),
                Token.Puncuation.Colon,
                Token.Literals.Numeric.Decimal("23"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("ref argument", () => {
            const input = Input.InMethod(`M(ref x);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Puncuation.OpenParen,
                Token.Keywords.Modifiers.Ref,
                Token.Variables.ReadWrite("x"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("out argument", () => {
            const input = Input.InMethod(`M(out x);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Puncuation.OpenParen,
                Token.Keywords.Modifiers.Out,
                Token.Variables.ReadWrite("x"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("generic with no arguments", () => {
            const input = Input.InMethod(`M<int>();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("int"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("nested generic with no arguments", () => {
            const input = Input.InMethod(`M<T<int>>();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("int"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("double-nested generic with no arguments", () => {
            const input = Input.InMethod(`M<T<U<int>>>();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Identifiers.MethodName("M"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("U"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("int"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("member of generic with no arguments", () => {
            const input = Input.InMethod(`C<int>.M();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Variables.Object("C"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("int"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.Accessor,
                Token.Identifiers.MethodName("M"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("member of qualified generic with no arguments", () => {
            const input = Input.InMethod(`N.C<int>.M();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Variables.Object("N"),
                Token.Puncuation.Accessor,
                Token.Variables.Object("C"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("int"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.Accessor,
                Token.Identifiers.MethodName("M"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });

        it("store result member of qualified generic with no arguments", () => {
            const input = Input.InMethod(`var o = N.C<int>.M();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("var"),
                Token.Variables.Local("o"),
                Token.Operators.Assignment,
                Token.Variables.Object("N"),
                Token.Puncuation.Accessor,
                Token.Variables.Object("C"),
                Token.Puncuation.TypeParameters.Begin,
                Token.Type("int"),
                Token.Puncuation.TypeParameters.End,
                Token.Puncuation.Accessor,
                Token.Identifiers.MethodName("M"),
                Token.Puncuation.OpenParen,
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });
        
        it("store result of invocation with two named arguments", () => {
            const input = Input.InMethod(`var o = M(x: 19, y: 23);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("var"),
                Token.Variables.Local("o"),
                Token.Operators.Assignment,
                Token.Identifiers.MethodName("M"),
                Token.Puncuation.OpenParen,
                Token.Variables.Parameter("x"),
                Token.Puncuation.Colon,
                Token.Literals.Numeric.Decimal("19"),
                Token.Puncuation.Comma,
                Token.Variables.Parameter("y"),
                Token.Puncuation.Colon,
                Token.Literals.Numeric.Decimal("23"),
                Token.Puncuation.CloseParen,
                Token.Puncuation.Semicolon
            ]);
        });
    });
});