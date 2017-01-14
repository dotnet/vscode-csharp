/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Preprocessor", () => {
        it("#define Foo", () => {
            const input = `#define Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.Define,
                Token.Identifiers.PreprocessorSymbol("Foo")
            ]);
        });

        it("#define Foo//Foo", () => {
            const input = `#define Foo//Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.Define,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Foo")
            ]);
        });

        it("#define Foo //Foo", () => {
            const input = `#define Foo //Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.Define,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Foo")
            ]);
        });

        it("#undef Foo", () => {
            const input = `#undef Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.Undef,
                Token.Identifiers.PreprocessorSymbol("Foo")
            ]);
        });

        it("#undef Foo//Foo", () => {
            const input = `#undef Foo//Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.Undef,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Foo")
            ]);
        });

        it("#undef Foo //Foo", () => {
            const input = `#undef Foo //Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.Undef,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Foo")
            ]);
        });

        it("#if true", () => {
            const input = `#if true`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.If,
                Token.Literals.Boolean.True
            ]);
        });

        it("#if false", () => {
            const input = `#if false`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.If,
                Token.Literals.Boolean.False
            ]);
        });

        it("#if Foo", () => {
            const input = `#if Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.If,
                Token.Identifiers.PreprocessorSymbol("Foo")
            ]);
        });

        it("#if Foo || true", () => {
            const input = `#if Foo || true`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.If,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Operators.Logical.Or,
                Token.Literals.Boolean.True
            ]);
        });

        it("#if Foo && true", () => {
            const input = `#if Foo && true`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.If,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Operators.Logical.And,
                Token.Literals.Boolean.True
            ]);
        });

        it("#if Foo == true", () => {
            const input = `#if Foo == true`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.If,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Operators.Relational.Equals,
                Token.Literals.Boolean.True
            ]);
        });

        it("#if Foo != true", () => {
            const input = `#if Foo != true`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.If,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Operators.Relational.NotEqual,
                Token.Literals.Boolean.True
            ]);
        });

        it("#if !Foo", () => {
            const input = `#if !Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.If,
                Token.Operators.Logical.Not,
                Token.Identifiers.PreprocessorSymbol("Foo")
            ]);
        });

        it("#if (Foo != true) && Bar", () => {
            const input = `#if (Foo != true) && Bar`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.If,
                Token.Punctuation.OpenParen,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Operators.Relational.NotEqual,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Operators.Logical.And,
                Token.Identifiers.PreprocessorSymbol("Bar")
            ]);
        });

        it("#if (Foo != true) && Bar //Foo", () => {
            const input = `#if (Foo != true) && Bar //Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.If,
                Token.Punctuation.OpenParen,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Operators.Relational.NotEqual,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Operators.Logical.And,
                Token.Identifiers.PreprocessorSymbol("Bar"),
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Foo")
            ]);
        });

        it("#if (Foo != true) && Bar //Foo", () => {
            const input = `#if (Foo != true) && Bar //Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.If,
                Token.Punctuation.OpenParen,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Operators.Relational.NotEqual,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Operators.Logical.And,
                Token.Identifiers.PreprocessorSymbol("Bar"),
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Foo")
            ]);
        });

        it("#elif true", () => {
            const input = `#elif true`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.ElIf,
                Token.Literals.Boolean.True
            ]);
        });

        it("#elif false", () => {
            const input = `#elif false`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.ElIf,
                Token.Literals.Boolean.False
            ]);
        });

        it("#elif Foo", () => {
            const input = `#elif Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.ElIf,
                Token.Identifiers.PreprocessorSymbol("Foo")
            ]);
        });

        it("#elif Foo || true", () => {
            const input = `#elif Foo || true`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.ElIf,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Operators.Logical.Or,
                Token.Literals.Boolean.True
            ]);
        });

        it("#elif Foo && true", () => {
            const input = `#elif Foo && true`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.ElIf,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Operators.Logical.And,
                Token.Literals.Boolean.True
            ]);
        });

        it("#elif Foo == true", () => {
            const input = `#elif Foo == true`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.ElIf,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Operators.Relational.Equals,
                Token.Literals.Boolean.True
            ]);
        });

        it("#elif Foo != true", () => {
            const input = `#elif Foo != true`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.ElIf,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Operators.Relational.NotEqual,
                Token.Literals.Boolean.True
            ]);
        });

        it("#elif !Foo", () => {
            const input = `#elif !Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.ElIf,
                Token.Operators.Logical.Not,
                Token.Identifiers.PreprocessorSymbol("Foo")
            ]);
        });

        it("#elif (Foo != true) && Bar", () => {
            const input = `#elif (Foo != true) && Bar`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.ElIf,
                Token.Punctuation.OpenParen,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Operators.Relational.NotEqual,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Operators.Logical.And,
                Token.Identifiers.PreprocessorSymbol("Bar")
            ]);
        });

        it("#elif (Foo != true) && Bar//Foo", () => {
            const input = `#elif (Foo != true) && Bar//Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.ElIf,
                Token.Punctuation.OpenParen,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Operators.Relational.NotEqual,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Operators.Logical.And,
                Token.Identifiers.PreprocessorSymbol("Bar"),
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Foo")
            ]);
        });

        it("#elif (Foo != true) && Bar //Foo", () => {
            const input = `#elif (Foo != true) && Bar //Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.ElIf,
                Token.Punctuation.OpenParen,
                Token.Identifiers.PreprocessorSymbol("Foo"),
                Token.Operators.Relational.NotEqual,
                Token.Literals.Boolean.True,
                Token.Punctuation.CloseParen,
                Token.Operators.Logical.And,
                Token.Identifiers.PreprocessorSymbol("Bar"),
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Foo")
            ]);
        });

        it("#else", () => {
            const input = `#else`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.Else,
            ]);
        });

        it("#else//Foo", () => {
            const input = `#else//Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.Else,
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Foo")
            ]);
        });

        it("#else //Foo", () => {
            const input = `#else //Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.Else,
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Foo")
            ]);
        });

        it("#endif", () => {
            const input = `#endif`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.EndIf,
            ]);
        });

        it("#endif//Foo", () => {
            const input = `#endif//Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.EndIf,
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Foo")
            ]);
        });

        it("#endif //Foo", () => {
            const input = `#endif //Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.EndIf,
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Foo")
            ]);
        });

        it("#warning This is a warning", () => {
            const input = `#warning This is a warning`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.Warning,
                Token.PreprocessorMessage("This is a warning")
            ]);
        });

        it("#error This is an error", () => {
            const input = `#error This is an error`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.Error,
                Token.PreprocessorMessage("This is an error")
            ]);
        });

        it("#region My Region", () => {
            const input = `#region My Region`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.Region,
                Token.PreprocessorMessage("My Region")
            ]);
        });

        it("#region \"My Region\"", () => {
            const input = `#region "My Region"`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.Region,
                Token.PreprocessorMessage("\"My Region\"")
            ]);
        });

        it("#endregion", () => {
            const input = `#endregion`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.EndRegion
            ]);
        });

        it("#endregion//Foo", () => {
            const input = `#endregion//Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.EndRegion,
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Foo")
            ]);
        });

        it("#endregion //Foo", () => {
            const input = `#endregion //Foo`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.EndRegion,
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Foo")
            ]);
        });

        it("preprocessor in enum members", () => {
            const input = `
public enum E
{
    A,
    B = A,
    C = 2 + A,

#if DEBUG
    D,
#endif

}`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Enum,
                Token.Identifiers.EnumName("E"),
                Token.Punctuation.OpenBrace,
                Token.Identifiers.EnumMemberName("A"),
                Token.Punctuation.Comma,
                Token.Identifiers.EnumMemberName("B"),
                Token.Operators.Assignment,
                Token.Variables.ReadWrite("A"),
                Token.Punctuation.Comma,
                Token.Identifiers.EnumMemberName("C"),
                Token.Operators.Assignment,
                Token.Literals.Numeric.Decimal("2"),
                Token.Operators.Arithmetic.Addition,
                Token.Variables.ReadWrite("A"),
                Token.Punctuation.Comma,

                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.If,
                Token.Identifiers.PreprocessorSymbol("DEBUG"),
                Token.Identifiers.EnumMemberName("D"),
                Token.Punctuation.Comma,
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.EndIf,

                Token.Punctuation.CloseBrace
            ]);
        });

        it("region name with double-quotes should be highlighted properly (issue #731)", () => {
            const input = Input.InClass(`
#region  " Register / Create New  "
// GET: /Account/Register
[Authorize(Roles = UserRoles.SuperUser)]
public ActionResult Register()
{
    RedirectToAction("Application");
    return View();
}
`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Punctuation.Hash,
                Token.Keywords.Preprocessor.Region,
                Token.PreprocessorMessage("\" Register / Create New  \""),
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text(" GET: /Account/Register"),
                Token.Punctuation.OpenBracket,
                Token.Type("Authorize"),
                Token.Punctuation.OpenParen,
                Token.Identifiers.PropertyName("Roles"),
                Token.Operators.Assignment,
                Token.Variables.Object("UserRoles"),
                Token.Punctuation.Accessor,
                Token.Variables.Property("SuperUser"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.CloseBracket,
                Token.Keywords.Modifiers.Public,
                Token.Type("ActionResult"),
                Token.Identifiers.MethodName("Register"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Identifiers.MethodName("RedirectToAction"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.String.Begin,
                Token.Literals.String("Application"),
                Token.Punctuation.String.End,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Keywords.Control.Return,
                Token.Identifiers.MethodName("View"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace
            ]);
        });
    });
});