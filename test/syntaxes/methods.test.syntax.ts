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
                Token.Type("void"),
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
                Token.Type("int"),
                Token.Identifiers.MethodName("Add"),
                Token.Punctuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Punctuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.OpenBrace,
                Token.Keywords.Return,
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
                Token.Identifiers.MethodName("GetString<T, TResult>"),
                Token.Punctuation.OpenParen,
                Token.Type("T"),
                Token.Variables.Parameter("arg"),
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
                Token.Type("int"),
                Token.Identifiers.MethodName("Add"),
                Token.Punctuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("x"),
                Token.Punctuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("y"),
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
                Token.Type("string"),
                Token.Type("IFoo"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("string"),
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
                Token.Type("string"),
                Token.Identifiers.MethodName("GetString"),
                Token.Punctuation.OpenParen,
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon]);
        });

        it("declaration in interface with parameters", () => {

            const input = Input.InInterface(`string GetString(string format, params object[] args);`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("string"),
                Token.Identifiers.MethodName("GetString"),
                Token.Punctuation.OpenParen,
                Token.Type("string"),
                Token.Variables.Parameter("format"),
                Token.Punctuation.Comma,
                Token.Keywords.Modifiers.Params,
                Token.Type("object"),
                Token.Punctuation.OpenBracket,
                Token.Punctuation.CloseBracket,
                Token.Variables.Parameter("args"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon]);
        });

        it("declaration in interface with generic constraints", () => {

            const input = Input.InInterface(`TResult GetString<T, TResult>(T arg) where T : TResult;`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Type("TResult"),
                Token.Identifiers.MethodName("GetString<T, TResult>"),
                Token.Punctuation.OpenParen,
                Token.Type("T"),
                Token.Variables.Parameter("arg"),
                Token.Punctuation.CloseParen,
                Token.Keywords.Where,
                Token.Type("T"),
                Token.Punctuation.Colon,
                Token.Type("TResult"),
                Token.Punctuation.Semicolon]);
        });

        it("commented parameters are highlighted properly (issue #802)", () => {

            const input = Input.InClass(`public void methodWithParametersCommented(int p1, /*int p2*/, int p3) {}`);
            const tokens = tokenize(input);

            tokens.should.deep.equal([
                Token.Keywords.Modifiers.Public,
                Token.Type("void"),
                Token.Identifiers.MethodName("methodWithParametersCommented"),
                Token.Punctuation.OpenParen,
                Token.Type("int"),
                Token.Variables.Parameter("p1"),
                Token.Punctuation.Comma,
                Token.Comment.MultiLine.Start,
                Token.Comment.MultiLine.Text("int p2"),
                Token.Comment.MultiLine.End,
                Token.Punctuation.Comma,
                Token.Type("int"),
                Token.Variables.Parameter("p3"),
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
                Token.Type("string"),
                Token.Punctuation.TypeParameters.End,
                Token.Variables.Parameter("blah"),
                Token.Punctuation.CloseParen,
                Token.Punctuation.Semicolon,
                Token.Type("Task"),
                Token.Identifiers.MethodName("test<T>"),
                Token.Punctuation.OpenParen,
                Token.Type("List"),
                Token.Punctuation.TypeParameters.Begin,
                Token.Type("T"),
                Token.Punctuation.TypeParameters.End,
                Token.Variables.Parameter("blah"),
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
                Token.Type("void"),
                Token.Identifiers.MethodName("AddToGoingUsers"),
                Token.Punctuation.OpenParen,
                Token.Type("Guid"),
                Token.Variables.Parameter("id"),
                Token.Punctuation.Comma,
                Token.Type("string"),
                Token.Variables.Parameter("user"),
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
                Token.Type("void"),
                Token.Identifiers.MethodName("AddToNotGoingUsers"),
                Token.Punctuation.OpenParen,
                Token.Type("Guid"),
                Token.Variables.Parameter("id"),
                Token.Punctuation.Comma,
                Token.Type("string"),
                Token.Variables.Parameter("user"),
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
                Token.Type("void"),
                Token.Identifiers.MethodName("AddToNotSureIfGoingUsers"),
                Token.Punctuation.OpenParen,
                Token.Type("Guid"),
                Token.Variables.Parameter("id"),
                Token.Punctuation.Comma,
                Token.Type("string"),
                Token.Variables.Parameter("user"),
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
    });
});