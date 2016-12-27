/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { Tokens } from './utils/tokenizer';
import { TokenizerUtil } from'./utils/tokenizerUtil';

describe("Grammar", function() {
    before(function() {
        should();
    });

    describe("Property", function() {
        it("declaration", function() {

const input = `
class Tester
{
    public IBooom Property
    {
        get { return null; }
        set { something = value; }
    }
}`;
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("public", 4, 5));
            tokens.should.contain(Tokens.Type("IBooom", 4, 12));
            tokens.should.contain(Tokens.PropertyIdentifier("Property", 4, 19));
            tokens.should.contain(Tokens.Keyword("get", 6, 9));
            tokens.should.contain(Tokens.Keyword("set", 7, 9));
        });

        it("declaration single line", function() {

const input = `
class Tester
{
    public IBooom Property { get { return null; } private set { something = value; } }
}`;
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("public", 4, 5));
            tokens.should.contain(Tokens.Type("IBooom", 4, 12));
            tokens.should.contain(Tokens.PropertyIdentifier("Property", 4, 19));
            tokens.should.contain(Tokens.Keyword("get", 4, 30));
            tokens.should.contain(Tokens.StorageModifierKeyword("private", 4, 51));
            tokens.should.contain(Tokens.Keyword("set", 4, 59));
        });


        it("declaration without modifiers", function() {

const input = `
class Tester
{
    IBooom Property {get; set;}
}`;
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.Type("IBooom", 4, 5));
            tokens.should.contain(Tokens.PropertyIdentifier("Property", 4, 12));
        });

        it("auto-property single line", function() {

const input = `
class Tester
{
    public IBooom Property { get; set; }
}`;
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("public", 4, 5));
            tokens.should.contain(Tokens.Type("IBooom", 4, 12));
            tokens.should.contain(Tokens.PropertyIdentifier("Property", 4, 19));
            tokens.should.contain(Tokens.Keyword("get", 4, 30));
            tokens.should.contain(Tokens.Keyword("set", 4, 35));
        });

         it("auto-property", function() {

const input = `
class Tester
{
    public IBooom Property
    {
        get;
        set;
    }
}`;
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("public", 4, 5));
            tokens.should.contain(Tokens.Type("IBooom", 4, 12));
            tokens.should.contain(Tokens.PropertyIdentifier("Property", 4, 19));
            tokens.should.contain(Tokens.Keyword("get", 6, 9));
            tokens.should.contain(Tokens.Keyword("set", 7, 9));
        });

        it("generic auto-property", function() {

const input = `
class Tester
{
    public Dictionary<string, List<T>[]> Property { get; set; }
}`;
            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("public", 4, 5));
            tokens.should.contain(Tokens.Type("Dictionary", 4, 12));
            tokens.should.contain(Tokens.Type("string", 4, 23));
            tokens.should.contain(Tokens.Type("List<T>[]", 4, 31));
            tokens.should.contain(Tokens.PropertyIdentifier("Property", 4, 42));
            tokens.should.contain(Tokens.Keyword("get", 4, 53));
            tokens.should.contain(Tokens.Keyword("set", 4, 58));
        });

        it("auto-property initializer", function() {

const input = `
class Tester
{
    public Dictionary<string, List<T>[]> Property { get; } = new Dictionary<string, List<T>[]>();
}`;

            let tokens = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("public", 4, 5));
            tokens.should.contain(Tokens.Type("Dictionary", 4, 12));
            tokens.should.contain(Tokens.Type("string", 4, 23));
            tokens.should.contain(Tokens.Type("List<T>[]", 4, 31));
            tokens.should.contain(Tokens.PropertyIdentifier("Property", 4, 42));
            tokens.should.contain(Tokens.Keyword("get", 4, 53));
            tokens.should.contain(Tokens.StorageModifierKeyword("new", 4, 62));
        });
    });
});


