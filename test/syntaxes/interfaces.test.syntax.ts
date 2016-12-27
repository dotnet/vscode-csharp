import { should } from 'chai';
import { Tokens, Token } from './utils/tokenizer';
import { TokenizerUtil } from './utils/tokenizerUtil';

describe("Grammar", () => {
    before(() => {
        should();
    });

    describe("Interfaces", () => {
        it("simple interface", () => {

            const input = `
interface IFoo { }
`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Interface(2, 1));
            tokens.should.contain(Tokens.Identifiers.InterfaceName("IFoo", 2, 11));
            tokens.should.contain(Tokens.Puncuation.CurlyBrace.Open(2, 16));
            tokens.should.contain(Tokens.Puncuation.CurlyBrace.Close(2, 18));
        });

        it("interface inheritance", () => {

            const input = `
interface IFoo { }
interface IBar : IFoo { }
`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Interface(3, 1));
            tokens.should.contain(Tokens.Identifiers.InterfaceName("IBar", 3, 11));
            tokens.should.contain(Tokens.Puncuation.Colon(3, 16));
            tokens.should.contain(Tokens.Type("IFoo", 3, 18));
            tokens.should.contain(Tokens.Puncuation.CurlyBrace.Open(3, 23));
            tokens.should.contain(Tokens.Puncuation.CurlyBrace.Close(3, 25));
        });

        it("generic interface", () => {

            const input = `
interface IFoo<T1, T2> { }
`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Interface(2, 1));
            tokens.should.contain(Tokens.Identifiers.InterfaceName("IFoo<T1, T2>", 2, 11));
            tokens.should.contain(Tokens.Puncuation.CurlyBrace.Open(2, 24));
            tokens.should.contain(Tokens.Puncuation.CurlyBrace.Close(2, 26));
        });

        it("generic interface with variance", () => {

            const input = `
interface IFoo<in T1, out T2> { }
`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Interface(2, 1));
            tokens.should.contain(Tokens.Identifiers.InterfaceName("IFoo<in T1, out T2>", 2, 11));
            tokens.should.contain(Tokens.Puncuation.CurlyBrace.Open(2, 31));
            tokens.should.contain(Tokens.Puncuation.CurlyBrace.Close(2, 33));
        });

        it("generic interface with constraints", () => {

            const input = `
interface IFoo<T1, T2> where T1 : T2 { }
`;

            let tokens: Token[] = TokenizerUtil.tokenize2(input);

            tokens.should.contain(Tokens.Keywords.Interface(2, 1));
            tokens.should.contain(Tokens.Identifiers.InterfaceName("IFoo<T1, T2>", 2, 11));
            tokens.should.contain(Tokens.Keywords.Where(2, 24));
            tokens.should.contain(Tokens.Type("T1", 2, 30));
            tokens.should.contain(Tokens.Puncuation.Colon(2, 33));
            tokens.should.contain(Tokens.Type("T2", 2, 35));
            tokens.should.contain(Tokens.Puncuation.CurlyBrace.Open(2, 38));
            tokens.should.contain(Tokens.Puncuation.CurlyBrace.Close(2, 40));
        });
    });
});


