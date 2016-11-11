import { Tokenizer, Token } from './tokenizer';

export class TokenizerUtil
{
    private static _tokenizer: Tokenizer = new Tokenizer("syntaxes/csharp.json");

    public static tokenize(input: string): Token[] {
        return TokenizerUtil._tokenizer.tokenize(input);
    }
}
