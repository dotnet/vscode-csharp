/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tokenize, Input, Token } from './utils/tokenize';

describe("Grammar", () => {
    before(() => should());

    describe("Methods", () => {
        it("single-line declaration with no parameters", () => {
            const input = Input.InClass(`void Foo() { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.Void,
                Token.Identifiers.MethodName("Foo"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("declaration with two parameters", () => {
            const input = Input.InClass(`
int Add(int x, int y)
{
    return x + y;
}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.Int,
                Token.Identifiers.MethodName("Add"),
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.Int,
                Token.Identifiers.ParameterName("x"),
                Token.Punctuation.Comma,
                Token.PrimitiveType.Int,
                Token.Identifiers.ParameterName("y"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Control.Return,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Arithmetic.Addition,
                Token.Variables.ReadWrite("y"),
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace]);
        });

        it("declaration in with generic constraints", () => {
            const input = Input.InClass(`TResult GetString<T, TResult>(T arg) where T : TResult { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("TResult"),
                Token.Identifiers.MethodName("GetString"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Identifiers.TypeParameterName("T"),
                Token.Punctuation.Comma,
                Token.Identifiers.TypeParameterName("TResult"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.OpenParen,
                Token.Type("T"),
                Token.Identifiers.ParameterName("arg"),
                Token.Punctuation.CloseParen,
                Token.Keywords.Where,
                Token.Type("T"),
                Token.Punctuation.Colon,
                Token.Type("TResult"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace]);
        });

        it("expression body", () => {
            const input = Input.InClass(`int Add(int x, int y) => x + y;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.Int,
                Token.Identifiers.MethodName("Add"),
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.Int,
                Token.Identifiers.ParameterName("x"),
                Token.Punctuation.Comma,
                Token.PrimitiveType.Int,
                Token.Identifiers.ParameterName("y"),
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Variables.ReadWrite("x"),
                Token.Operators.Arithmetic.Addition,
                Token.Variables.ReadWrite("y"),
                Token.Punctuation.Semicolon]);
        });

        it("explicitly-implemented interface member", () => {
            const input = Input.InClass(`string IFoo<string>.GetString();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.String,
                Token.Type("IFoo"),
                Token.Punctuation.TypeParameters.Begin,
                Token.PrimitiveType.String,
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.Accessor,
                Token.Identifiers.MethodName("GetString"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon]);
        });

        it("declaration in interface", () => {
            const input = Input.InInterface(`string GetString();`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.String,
                Token.Identifiers.MethodName("GetString"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon]);
        });

        it("declaration in interface with parameters", () => {
            const input = Input.InInterface(`string GetString(string format, params object[] args);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.PrimitiveType.String,
                Token.Identifiers.MethodName("GetString"),
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.String,
                Token.Identifiers.ParameterName("format"),
                Token.Punctuation.Comma,
                Token.Keywords.Modifiers.Params,
                Token.PrimitiveType.Object,
                Token.Punctuation.OpenBracket,
                Token.Punctuation.CloseBracket,
                Token.Identifiers.ParameterName("args"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon]);
        });

        it("declaration in interface with generic constraints", () => {
            const input = Input.InInterface(`TResult GetString<T, TResult>(T arg) where T : TResult;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("TResult"),
                Token.Identifiers.MethodName("GetString"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Identifiers.TypeParameterName("T"),
                Token.Punctuation.Comma,
                Token.Identifiers.TypeParameterName("TResult"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.OpenParen,
                Token.Type("T"),
                Token.Identifiers.ParameterName("arg"),
                Token.Punctuation.CloseParen,
                Token.Keywords.Where,
                Token.Type("T"),
                Token.Punctuation.Colon,
                Token.Type("TResult"),
                Token.Punctuation.Semicolon]);
        });

        it("public override", () => {
            const input = Input.InClass(`public override M() { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Override,
                Token.Identifiers.MethodName("M"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("public virtual", () => {
            const input = Input.InClass(`public virtual M() { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Virtual,
                Token.Identifiers.MethodName("M"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("extension method", () => {
            const input = Input.InClass(`public void M(this object o) { }`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.PrimitiveType.Void,
                Token.Identifiers.MethodName("M"),
                Token.Punctuation.OpenParen,
                Token.Keywords.Modifiers.This,
                Token.PrimitiveType.Object,
                Token.Identifiers.ParameterName("o"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("commented parameters are highlighted properly (issue #802)", () => {
            const input = Input.InClass(`public void methodWithParametersCommented(int p1, /*int p2*/, int p3) {}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.PrimitiveType.Void,
                Token.Identifiers.MethodName("methodWithParametersCommented"),
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.Int,
                Token.Identifiers.ParameterName("p1"),
                Token.Punctuation.Comma,
                Token.Comment.MultiLine.Start,
                Token.Comment.MultiLine.Text("int p2"),
                Token.Comment.MultiLine.End,
                Token.Punctuation.Comma,
                Token.PrimitiveType.Int,
                Token.Identifiers.ParameterName("p3"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("return type is highlighted properly in interface (issue #830)", () => {
            const input = `
public interface test
{
    Task test1(List<string> blah);
    Task test<T>(List<T> blah);
}`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Interface,
                Token.Identifiers.InterfaceName("test"),
                Token.Punctuation.OpenBrace,
                Token.Type("Task"),
                Token.Identifiers.MethodName("test1"),
                Token.Punctuation.OpenParen,
                Token.Type("List"),
                Token.Punctuation.TypeParameters.Begin,
                Token.PrimitiveType.String,
                Token.Punctuation.TypeParameters.End,
                Token.Identifiers.ParameterName("blah"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Type("Task"),
                Token.Identifiers.MethodName("test"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Identifiers.TypeParameterName("T"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.OpenParen,
                Token.Type("List"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Punctuation.TypeParameters.End,
                Token.Identifiers.ParameterName("blah"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("attributes are highlighted properly (issue #829)", () => {
            const input = `
namespace Test
{
    public class TestClass
    {
        [HttpPut]
        [Route("/meetups/{id}/users-going")]
        public void AddToGoingUsers(Guid id, string user) => _commandSender.Send(new MarkUserAsGoing(id, user.User));

        [HttpPut]
        [Route("/meetups/{id}/users-not-going")]
        public void AddToNotGoingUsers(Guid id, string user) => _commandSender.Send(new MarkUserAsNotGoing(id, user.User));

        [HttpPut]
        [Route("/meetups/{id}/users-not-sure-if-going")]
        public void AddToNotSureIfGoingUsers(Guid id, string user) => _commandSender.Send(new MarkUserAsNotSureIfGoing(id, user.User));
    }
}`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Namespace,
                Token.Identifiers.NamespaceName("Test"),
                Token.Punctuation.OpenBrace,
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("TestClass"),
                Token.Punctuation.OpenBrace,

                // [HttpPut]
                // [Route("/meetups/{id}/users-going")]
                // public void AddToGoingUsers(Guid id, string user) => _commandSender.Send(new MarkUserAsGoing(id, user.User));
                Token.Punctuation.OpenBracket,
                Token.Type("HttpPut"),
                Token.Punctuation.CloseBracket,
                Token.Punctuation.OpenBracket,
                Token.Type("Route"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.String.Begin,
                Token.Literals.String("/meetups/{id}/users-going"),
                Token.Punctuation.String.End,
                Token.Punctuation.CloseParen,
                Token.Punctuation.CloseBracket,
                Token.Keywords.Modifiers.Public,
                Token.PrimitiveType.Void,
                Token.Identifiers.MethodName("AddToGoingUsers"),
                Token.Punctuation.OpenParen,
                Token.Type("Guid"),
                Token.Identifiers.ParameterName("id"),
                Token.Punctuation.Comma,
                Token.PrimitiveType.String,
                Token.Identifiers.ParameterName("user"),
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Variables.Object("_commandSender"),
                Token.Punctuation.Accessor,
                Token.Identifiers.MethodName("Send"),
                Token.Punctuation.OpenParen,
                Token.Keywords.New,
                Token.Type("MarkUserAsGoing"),
                Token.Punctuation.OpenParen,
                Token.Variables.ReadWrite("id"),
                Token.Punctuation.Comma,
                Token.Variables.Object("user"),
                Token.Punctuation.Accessor,
                Token.Variables.Property("User"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,

                // [HttpPut]
                // [Route("/meetups/{id}/users-not-going")]
                // public void AddToNotGoingUsers(Guid id, string user) => _commandSender.Send(new MarkUserAsNotGoing(id, user.User));
                Token.Punctuation.OpenBracket,
                Token.Type("HttpPut"),
                Token.Punctuation.CloseBracket,
                Token.Punctuation.OpenBracket,
                Token.Type("Route"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.String.Begin,
                Token.Literals.String("/meetups/{id}/users-not-going"),
                Token.Punctuation.String.End,
                Token.Punctuation.CloseParen,
                Token.Punctuation.CloseBracket,
                Token.Keywords.Modifiers.Public,
                Token.PrimitiveType.Void,
                Token.Identifiers.MethodName("AddToNotGoingUsers"),
                Token.Punctuation.OpenParen,
                Token.Type("Guid"),
                Token.Identifiers.ParameterName("id"),
                Token.Punctuation.Comma,
                Token.PrimitiveType.String,
                Token.Identifiers.ParameterName("user"),
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Variables.Object("_commandSender"),
                Token.Punctuation.Accessor,
                Token.Identifiers.MethodName("Send"),
                Token.Punctuation.OpenParen,
                Token.Keywords.New,
                Token.Type("MarkUserAsNotGoing"),
                Token.Punctuation.OpenParen,
                Token.Variables.ReadWrite("id"),
                Token.Punctuation.Comma,
                Token.Variables.Object("user"),
                Token.Punctuation.Accessor,
                Token.Variables.Property("User"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,

                // [HttpPut]
                // [Route("/meetups/{id}/users-not-sure-if-going")]
                // public void AddToNotSureIfGoingUsers(Guid id, string user) => _commandSender.Send(new MarkUserAsNotSureIfGoing(id, user.User));
                Token.Punctuation.OpenBracket,
                Token.Type("HttpPut"),
                Token.Punctuation.CloseBracket,
                Token.Punctuation.OpenBracket,
                Token.Type("Route"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.String.Begin,
                Token.Literals.String("/meetups/{id}/users-not-sure-if-going"),
                Token.Punctuation.String.End,
                Token.Punctuation.CloseParen,
                Token.Punctuation.CloseBracket,
                Token.Keywords.Modifiers.Public,
                Token.PrimitiveType.Void,
                Token.Identifiers.MethodName("AddToNotSureIfGoingUsers"),
                Token.Punctuation.OpenParen,
                Token.Type("Guid"),
                Token.Identifiers.ParameterName("id"),
                Token.Punctuation.Comma,
                Token.PrimitiveType.String,
                Token.Identifiers.ParameterName("user"),
                Token.Punctuation.CloseParen,
                Token.Operators.Arrow,
                Token.Variables.Object("_commandSender"),
                Token.Punctuation.Accessor,
                Token.Identifiers.MethodName("Send"),
                Token.Punctuation.OpenParen,
                Token.Keywords.New,
                Token.Type("MarkUserAsNotSureIfGoing"),
                Token.Punctuation.OpenParen,
                Token.Variables.ReadWrite("id"),
                Token.Punctuation.Comma,
                Token.Variables.Object("user"),
                Token.Punctuation.Accessor,
                Token.Variables.Property("User"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,

                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("shadowed methods are highlighted properly (issue #1084)", () => {
            const input = Input.InClass(`
private new void foo1() //Correct highlight
{
}

new void foo2() //Function name not highlighted
{
}
`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Private,
                Token.Keywords.Modifiers.New,
                Token.PrimitiveType.Void,
                Token.Identifiers.MethodName("foo1"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Correct highlight"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace,
                Token.Keywords.Modifiers.New,
                Token.PrimitiveType.Void,
                Token.Identifiers.MethodName("foo2"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("Function name not highlighted"),
                Token.Punctuation.OpenBrace,
                Token.Punctuation.CloseBrace
            ]);
        });

        it("comment at end of line does not change highlights - 1 (issue #1091)", () => {
            const input = Input.InClass(`
public abstract void Notify(PlayerId playerId, ISessionResponse response); //the
`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Abstract,
                Token.PrimitiveType.Void,
                Token.Identifiers.MethodName("Notify"),
                Token.Punctuation.OpenParen,
                Token.Type("PlayerId"),
                Token.Identifiers.ParameterName("playerId"),
                Token.Punctuation.Comma,
                Token.Type("ISessionResponse"),
                Token.Identifiers.ParameterName("response"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("the")
            ]);
        });

        it("comment at end of line does not change highlights - 2 (issue #1091)", () => {
            const input = Input.InClass(`
public abstract void Notify(PlayerId playerId, ISessionResponse response); //the 
`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Abstract,
                Token.PrimitiveType.Void,
                Token.Identifiers.MethodName("Notify"),
                Token.Punctuation.OpenParen,
                Token.Type("PlayerId"),
                Token.Identifiers.ParameterName("playerId"),
                Token.Punctuation.Comma,
                Token.Type("ISessionResponse"),
                Token.Identifiers.ParameterName("response"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("the ")
            ]);
        });

        it("comment at end of line does not change highlights - 3 (issue #1091)", () => {
            const input = Input.InClass(`
public abstract void Notify(PlayerId playerId, ISessionResponse response); //the a
`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Modifiers.Abstract,
                Token.PrimitiveType.Void,
                Token.Identifiers.MethodName("Notify"),
                Token.Punctuation.OpenParen,
                Token.Type("PlayerId"),
                Token.Identifiers.ParameterName("playerId"),
                Token.Punctuation.Comma,
                Token.Type("ISessionResponse"),
                Token.Identifiers.ParameterName("response"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text("the a")
            ]);
        });

        it("value is not incorrectly highlighted (issue #268)", () => {
            const input = `
namespace x {
public class ClassA<T>
{
   public class ClassAa<TT>
   {
      public bool MyMethod(string key, TT value)
      {
         return someObject.SomeCall(key, value); // on this line, 'value' is highlighted as though it were the keyword being used in a setter
      }
   }
}
}
`;
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Namespace,
                Token.Identifiers.NamespaceName("x"),
                Token.Punctuation.OpenBrace,
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("ClassA"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Identifiers.TypeParameterName("T"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Modifiers.Public,
                Token.Keywords.Class,
                Token.Identifiers.ClassName("ClassAa"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Identifiers.TypeParameterName("TT"),
                Token.Punctuation.TypeParameters.End,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Modifiers.Public,
                Token.PrimitiveType.Bool,
                Token.Identifiers.MethodName("MyMethod"),
                Token.Punctuation.OpenParen,
                Token.PrimitiveType.String,
                Token.Identifiers.ParameterName("key"),
                Token.Punctuation.Comma,
                Token.Type("TT"),
                Token.Identifiers.ParameterName("value"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Control.Return,
                Token.Variables.Object("someObject"),
                Token.Punctuation.Accessor,
                Token.Identifiers.MethodName("SomeCall"),
                Token.Punctuation.OpenParen,
                Token.Variables.ReadWrite("key"),
                Token.Punctuation.Comma,
                Token.Variables.ReadWrite("value"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Comment.SingleLine.Start,
                Token.Comment.SingleLine.Text(" on this line, 'value' is highlighted as though it were the keyword being used in a setter"),
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseBrace,
                Token.Punctuation.CloseBrace
            ]);
        });
    });
});