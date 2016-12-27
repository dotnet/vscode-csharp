import { ITokenizeLineResult, Registry, IGrammar, StackElement } from 'vscode-textmate';

export class Tokenizer {
    private _grammar: IGrammar;

    constructor(grammarFilePath: string) {
        this._grammar = new Registry().loadGrammarFromPathSync(grammarFilePath);
    }

    public tokenize(input: string): Token[] {
        let tokens: Token[] = [];

        // ensure consistent line-endings irrelevant of OS
        input = input.replace("\r\n", "\n");

        let previousStack: StackElement = null;

        const lines: string[] = input.split("\n");

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];

            let result: ITokenizeLineResult = this._grammar.tokenizeLine(line, previousStack);
            previousStack = result.ruleStack;

            for (const token of result.tokens) {
                const text = line.substring(token.startIndex, token.endIndex);
                const type: string = token.scopes[token.scopes.length - 1];
                tokens.push(new Token(text, type, lineIndex + 1, token.startIndex + 1));
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

    function createToken(text: string, type: string, line?: number, column?: number): Token {
        return new Token(text, type, line, column);
    }

    export namespace Comment {
        export const LeadingWhitespace = (text: string, line?: number, column?: number) =>
            createToken(text, "punctuation.whitespace.comment.leading.cs", line, column);

        export namespace MultiLine {
            export const End = (line?: number, column?: number) =>
                createToken("*/", "punctuation.definition.comment.cs", line, column);

            export const Start = (line?: number, column?: number) =>
                createToken("/*", "punctuation.definition.comment.cs", line, column);

            export const Text = (text: string, line?: number, column?: number) =>
                createToken(text, "comment.block.cs", line, column);
        }

        export namespace SingleLine {
            export const Start = (line?: number, column?: number) =>
                createToken("//", "punctuation.definition.comment.cs", line, column);

            export const Text = (text: string, line?: number, column?: number) =>
                createToken(text, "comment.line.double-slash.cs", line, column);
        }
    }

    export namespace Identifiers {
        export const AliasName = (text: string, line?: number, column?: number) =>
            createToken(text, "entity.name.type.alias.cs", line, column);

        export const ClassName = (text: string, line?: number, column?: number) =>
            createToken(text, "entity.name.type.class.cs", line, column);

        export const NamespaceName = (text: string, line?: number, column?: number) =>
            createToken(text, "entity.name.type.namespace.cs", line, column);

        export const PropertyName = (text: string, line?: number, column?: number) =>
            createToken(text, "entity.name.function.cs", line, column);
    }

    export namespace Keywords {
        export namespace Modifiers {
            export const Abstract = (line?: number, column?: number) =>
                createToken("abstract", "storage.modifier.cs", line, column);

            export const Internal = (line?: number, column?: number) =>
                createToken("internal", "storage.modifier.cs", line, column);

            export const New = (line?: number, column?: number) =>
                createToken("new", "storage.modifier.cs", line, column);

            export const Partial = (line?: number, column?: number) =>
                createToken("partial", "storage.modifier.cs", line, column);

            export const Private = (line?: number, column?: number) =>
                createToken("private", "storage.modifier.cs", line, column);

            export const Protected = (line?: number, column?: number) =>
                createToken("protected", "storage.modifier.cs", line, column);

            export const Public = (line?: number, column?: number) =>
                createToken("public", "storage.modifier.cs", line, column);

            export const Sealed = (line?: number, column?: number) =>
                createToken("sealed", "storage.modifier.cs", line, column);

            export const Static = (line?: number, column?: number) =>
                createToken("static", "storage.modifier.cs", line, column);
        }

        export const Alias = (line?: number, column?: number) =>
            createToken("alias", "keyword.other.alias.cs", line, column);

        export const AttributeSpecifier = (text: string, line?: number, column?: number) =>
            createToken(text, "keyword.other.attribute-specifier.cs", line, column);

        export const Class = (line?: number, column?: number) =>
            createToken("class", "keyword.other.class.cs", line, column);

        export const Extern = (line?: number, column?: number) =>
            createToken("extern", "keyword.other.extern.cs", line, column);

        export const Namespace = (line?: number, column?: number) =>
            createToken("namespace", "keyword.other.namespace.cs", line, column);

        export const New = (line?: number, column?: number) =>
            createToken("new", "keyword.other.new.cs", line, column);

        export const Static = (line?: number, column?: number) =>
            createToken("static", "keyword.other.static.cs", line, column);

        export const Struct = (line?: number, column?: number) =>
            createToken("struct", "keyword.other.struct.cs", line, column);

        export const Using = (line?: number, column?: number) =>
            createToken("using", "keyword.other.using.cs", line, column);

        export const Where = (line?: number, column?: number) =>
            createToken("where", "keyword.other.where.cs", line, column);
    }

    export namespace Literals {
        export namespace Boolean {
            export const False = (line?: number, column?: number) =>
                createToken("false", "constant.language.boolean.false.cs", line, column);

            export const True = (line?: number, column?: number) =>
                createToken("true", "constant.language.boolean.true.cs", line, column);
        }

        export const Null = (line?: number, column?: number) =>
            createToken("null", "constant.language.null.cs", line, column);

        export namespace Numeric {
            export const Binary = (text: string, line?: number, column?: number) =>
                createToken(text, "constant.numeric.binary.cs", line, column);

            export const Decimal = (text: string, line?: number, column?: number) =>
                createToken(text, "constant.numeric.decimal.cs", line, column);

            export const Hexadecimal = (text: string, line?: number, column?: number) =>
                createToken(text, "constant.numeric.hex.cs", line, column);
        }

        export const String = (text: string, line?: number, column?: number) =>
            createToken(text, "string.quoted.double.cs", line, column);
    }

    export namespace Operators {
        export const Assignment = (line?: number, column?: number) =>
            createToken("=", "keyword.operator.assignment.cs", line, column);
    }

    export namespace Puncuation {
        export const Accessor = (line?: number, column?: number) =>
            createToken(".", "punctuation.accessor.cs", line, column);

        export const Colon = (line?: number, column?: number) =>
            createToken(":", "punctuation.separator.colon.cs", line, column);

        export const Comma = (line?: number, column?: number) =>
            createToken(",", "punctuation.separator.comma.cs", line, column);

        export namespace CurlyBrace {
            export const Close = (line?: number, column?: number) =>
                createToken("}", "punctuation.curlybrace.close.cs", line, column);

            export const Open = (line?: number, column?: number) =>
                createToken("{", "punctuation.curlybrace.open.cs", line, column);
        }

        export namespace Parenthesis {
            export const Close = (line?: number, column?: number) =>
                createToken(")", "punctuation.parenthesis.close.cs", line, column);

            export const Open = (line?: number, column?: number) =>
                createToken("(", "punctuation.parenthesis.open.cs", line, column);
        }

        export const Semicolon = (line?: number, column?: number) =>
            createToken(";", "punctuation.terminator.statement.cs", line, column);

        export namespace SquareBracket {
            export const Close = (line?: number, column?: number) =>
                createToken("]", "punctuation.squarebracket.close.cs", line, column);

            export const Open = (line?: number, column?: number) =>
                createToken("[", "punctuation.squarebracket.open.cs", line, column);
        }

        export namespace String {
            export const Begin = (line?: number, column?: number) =>
                createToken('"', "punctuation.definition.string.begin.cs", line, column);

            export const End = (line?: number, column?: number) =>
                createToken('"', "punctuation.definition.string.end.cs", line, column);
        }

        export const TypeParametersBegin = (line?: number, column?: number) =>
            createToken("<", "punctuation.definition.typeparameters.begin.cs", line, column);

        export const TypeParametersEnd = (line?: number, column?: number) =>
            createToken(">", "punctuation.definition.typeparameters.end.cs", line, column);
    }

    export namespace Variables {
        export const Alias = (text: string, line?: number, column?: number) =>
            createToken(text, "variable.other.alias.cs", line, column);
    }

    export const StorageModifierKeyword = (text: string, line?: number, column?: number) =>
        createToken(text, "storage.modifier.cs", line, column);

    export const Type = (text: string, line?: number, column?: number) =>
        createToken(text, "storage.type.cs", line, column);

    export const Keyword = (text: string, line?: number, column?: number) =>
        createToken(text, "keyword.other.cs", line, column);

    export const FieldIdentifier = (text: string, line?: number, column?: number) =>
        createToken(text, "entity.name.variable.cs", line, column);

    export const StringDoubleQuoted = (text: string, line?: number, column?: number) =>
        createToken(text, "string.quoted.double.cs", line, column);

    export const StringDoubleQuotedVerbatim = (text: string, line?: number, column?: number) =>
        createToken(text, "string.quoted.double.literal.cs", line, column);

    export const EventIdentifier = (text: string, line?: number, column?: number) =>
        createToken(text, "entity.name.variable.cs", line, column);

    export const LanguageConstant = (text: string, line?: number, column?: number) =>
        createToken(text, "constant.language.cs", line, column);

    export const PropertyIdentifier = (text: string, line?: number, column?: number) =>
        createToken(text, "entity.name.function.cs", line, column);

    export const StringInterpolatedExpression = (text: string, line?: number, column?: number) =>
        createToken(text, "meta.interpolated.expression.cs", line, column);

    export const StringStart = (text: string, line?: number, column?: number) =>
        createToken(text, "punctuation.definition.string.begin.cs", line, column);

    export const StringEnd = (text: string, line?: number, column?: number) =>
        createToken(text, "punctuation.definition.string.end.cs", line, column);
}
