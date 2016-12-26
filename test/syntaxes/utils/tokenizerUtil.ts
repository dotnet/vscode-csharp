import { Tokenizer, Token } from './tokenizer';

export class TokenizerUtil
{
    private static _tokenizer: Tokenizer = new Tokenizer("syntaxes/csharp.json");
    private static _tokenizer2: Tokenizer = new Tokenizer("syntaxes/csharp2.json");

    public static tokenize(input: string): Token[] {
        return TokenizerUtil._tokenizer.tokenize(input);
    }

    public static tokenize2(input: string): Token[] {
        return TokenizerUtil._tokenizer2.tokenize(input);
    }
}
