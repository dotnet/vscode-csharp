import {ITokenizeLineResult, Registry, IGrammar, StackElement} from 'vscode-textmate';

export class Tokenizer
{
    private _grammar : IGrammar;

    constructor(grammarFilePath: string) {
        this._grammar = new Registry().loadGrammarFromPathSync(grammarFilePath);
    }

    public tokenize(input: string): Token[] {
        let tokens: Token[] = [];

        // ensure consistent line-endings irrelevant of OS
        input = input.replace("\r\n","\n");

        let previousStack : StackElement = null;

        const lines: string[] = input.split("\n");

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];

            let result: ITokenizeLineResult = this._grammar.tokenizeLine(line, previousStack);
            previousStack = result.ruleStack;

            for (const token of result.tokens) {
                const text = line.substring(token.startIndex, token.endIndex);
                const type : string = token.scopes[token.scopes.length - 1];
                tokens.push(new Token(text, type, lineIndex+1, token.startIndex + 1));
            }
        }

        return tokens;
    }
}

export class Token {
    constructor(text: string, type: string, line?: number, column?: number) {
        this.text = text;
        this.type = type;
        this.column = column;
        this.line = line;
    }

    public text: string;
    public type: string;
    public line: number;
    public column: number;
}

export namespace Tokens {

    function createToken(text: string, type: string, line?: number, column?: number) : Token {
        return new Token(text, type, line, column);
    }

    export const NamespaceKeyword = (text: string, line?: number, column?: number) =>
        createToken(text, "keyword.other.namespace.cs", line, column);

    export const NamespaceIdentifier = (text: string, line?: number, column?: number) =>
        createToken(text, "entity.name.type.namespace.cs", line, column);

    export const UsingKeyword = (text: string, line?: number, column?: number) =>
        createToken(text, "keyword.other.using.cs", line, column);

    export const ClassKeyword = (text: string, line?: number, column?: number) =>
        createToken(text, "storage.modifier.cs", line, column);

    export const ClassIdentifier = (text: string, line?: number, column?: number) =>
        createToken(text, "storage.type.cs", line, column);

    export const StorageModifierKeyword = (text: string, line?: number, column?: number) =>
        createToken(text, "storage.modifier.cs", line, column);

    export const Type = (text: string, line?: number, column?: number) =>
        createToken(text, "storage.type.cs", line, column);

    export const Keyword = (text: string, line?: number, column?: number) =>
        createToken(text, "keyword.other.cs", line, column);

    export const FieldIdentifier = (text: string, line?: number, column?: number) =>
        createToken(text, "entity.name.variable.cs", line, column);

    export const StringQuoted = (text: string, line?: number, column?: number) =>
        createToken(text, "string.quoted.double.cs", line, column);

    export const EventIdentifier = (text: string, line?: number, column?: number) =>
        createToken(text, "entity.name.variable.cs", line, column);

    export const LanguageConstant = (text: string, line?: number, column?: number) =>
        createToken(text, "constant.language.cs", line, column);

    export const PropertyIdentifier = (text: string, line?: number, column?: number) =>
        createToken(text, "entity.name.function.cs", line, column);
}
