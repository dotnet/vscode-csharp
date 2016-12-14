import { should } from 'chai';
import { Tokens, Token } from './utils/tokenizer';
import { TokenizerUtil } from'./utils/tokenizerUtil';

describe("Grammar", function() {
    before(function() {
        should();
    });

    describe("Field", function() {
        it("declaration", function() {

const input = `
public class Tester
{
    private List _field;
    private List field;
    private List field123;
}`;

            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("private", 4, 5));
            tokens.should.contain(Tokens.Type("List", 4, 13));
            tokens.should.contain(Tokens.FieldIdentifier("_field", 4, 18));

            tokens.should.contain(Tokens.FieldIdentifier("field", 5, 18));
            tokens.should.contain(Tokens.FieldIdentifier("field123", 6, 18));
        });

        it("generic", function () {

            const input = `
public class Tester
{
    private Dictionary< List<T>, Dictionary<T, D>> _field;
}`;

            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("private", 4, 5));
            tokens.should.contain(Tokens.Type("Dictionary< List<T>, Dictionary<T, D>>", 4, 13));
            tokens.should.contain(Tokens.FieldIdentifier("_field", 4, 52));
        });


        it("modifiers", function() {

const input = `
public class Tester
{
    private static readonly List _field;
    readonly string _field2;
    string _field3;
}`;

            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("private", 4, 5));
            tokens.should.contain(Tokens.StorageModifierKeyword("static", 4, 13));
            tokens.should.contain(Tokens.StorageModifierKeyword("readonly", 4, 20));
            tokens.should.contain(Tokens.Type("List", 4, 29));
            tokens.should.contain(Tokens.FieldIdentifier("_field", 4, 34));

            tokens.should.contain(Tokens.FieldIdentifier("_field2", 5, 21));

            tokens.should.contain(Tokens.FieldIdentifier("_field3", 6, 12));
        });

        it("types", function() {

const input = `
public class Tester
{
    string field123;
    string[] field123;
}`;

            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.Type("string", 4, 5));
            tokens.should.contain(Tokens.FieldIdentifier("field123", 4, 12));

            tokens.should.contain(Tokens.Type("string[]", 5, 5));
            tokens.should.contain(Tokens.FieldIdentifier("field123", 5, 14));
        });

        it("assignment", function() {

const input = `
public class Tester
{
    private string field = "hello";
    const   bool   field = true;
}`;

            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("private", 4, 5));
            tokens.should.contain(Tokens.Type("string", 4, 13));
            tokens.should.contain(Tokens.FieldIdentifier("field", 4, 20));
            tokens.should.contain(Tokens.StringDoubleQuoted("hello", 4, 29));

            tokens.should.contain(Tokens.StorageModifierKeyword("const", 5, 5));
            tokens.should.contain(Tokens.Type("bool", 5, 13));
            tokens.should.contain(Tokens.FieldIdentifier("field", 5, 20));
            tokens.should.contain(Tokens.LanguageConstant("true", 5, 28));
        });

        it("expression body", function() {

const input = `
public class Tester
{
    private string field => "hello";
    const   bool   field => true;
}`;

            let tokens: Token[] = TokenizerUtil.tokenize(input);

            tokens.should.contain(Tokens.StorageModifierKeyword("private", 4, 5));
            tokens.should.contain(Tokens.Type("string", 4, 13));
            tokens.should.contain(Tokens.FieldIdentifier("field", 4, 20));
            tokens.should.contain(Tokens.StringDoubleQuoted("hello", 4, 30));

            tokens.should.contain(Tokens.StorageModifierKeyword("const", 5, 5));
            tokens.should.contain(Tokens.Type("bool", 5, 13));
            tokens.should.contain(Tokens.FieldIdentifier("field", 5, 20));
            tokens.should.contain(Tokens.LanguageConstant("true", 5, 29));
        });
    });
});


