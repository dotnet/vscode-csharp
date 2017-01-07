/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITokenizeLineResult, Registry, StackElement } from 'vscode-textmate';

const registry = new Registry();
const grammar = registry.loadGrammarFromPathSync('syntaxes/csharp.tmLanguage');
const excludedTypes = ['source.cs', 'meta.interpolation.cs', 'meta.type.parameters.cs']

export function tokenize(input: string | Input, excludeTypes: boolean = true): Token[] {
    if (typeof input === "string") {
        input = Input.FromText(input);
    }

    let tokens: Token[] = [];
    let previousStack: StackElement = null;

    for (let lineIndex = 0; lineIndex < input.lines.length; lineIndex++) {
        const line = input.lines[lineIndex];

        let lineResult = grammar.tokenizeLine(line, previousStack);
        previousStack = lineResult.ruleStack;

        if (lineIndex < input.span.startLine || lineIndex > input.span.endLine) {
            continue;
        }

        for (const token of lineResult.tokens) {
            if ((lineIndex === input.span.startLine && token.startIndex < input.span.startIndex) ||
                (lineIndex === input.span.endLine && token.endIndex > input.span.endIndex)) {
                continue;
            }

            const text = line.substring(token.startIndex, token.endIndex);
            const type = token.scopes[token.scopes.length - 1];

            if (excludeTypes === false || excludedTypes.indexOf(type) < 0) {
                tokens.push(createToken(text, type));
            }
        }
    }

    return tokens;
}

interface Span {
    startLine: number;
    startIndex: number;
    endLine: number;
    endIndex: number;
}

export class Input {
    private constructor(
        public lines: string[],
        public span: Span) { }

    public static FromText(text: string) {
        // ensure consistent line-endings irrelevant of OS
        text = text.replace('\r\n', '\n');
        let lines = text.split('\n');

        return new Input(lines, { startLine: 0, startIndex: 0, endLine: lines.length - 1, endIndex: lines[lines.length - 1].length });
    }

    public static InClass(input: string) {
        let text = `
class TestClass {
    ${input}
}`;

        // ensure consistent line-endings irrelevant of OS
        text = text.replace('\r\n', '\n');
        let lines = text.split('\n');

        return new Input(lines, { startLine: 2, startIndex: 4, endLine: lines.length - 1, endIndex: 0 });
    }

    public static InInterface(input: string) {
        let text = `
interface TestInterface {
    ${input}
}`;

        // ensure consistent line-endings irrelevant of OS
        text = text.replace('\r\n', '\n');
        let lines = text.split('\n');

        return new Input(lines, { startLine: 2, startIndex: 4, endLine: lines.length - 1, endIndex: 0 });
    }

    public static InMethod(input: string) {
        let text = `
class TestClass {
    void TestMethod() {
        ${input}
    }
}`;

        // ensure consistent line-endings irrelevant of OS
        text = text.replace('\r\n', '\n');
        let lines = text.split('\n');

        return new Input(lines, { startLine: 3, startIndex: 8, endLine: lines.length - 2, endIndex: 0 });
    }

    public static InNamespace(input: string) {
        let text = `
namespace TestNamespace {
    ${input}
}`;

        // ensure consistent line-endings irrelevant of OS
        text = text.replace('\r\n', '\n');
        let lines = text.split('\n');

        return new Input(lines, { startLine: 2, startIndex: 4, endLine: lines.length - 1, endIndex: 0 });
    }
}

export interface Token {
    text: string;
    type: string;
}

function createToken(text: string, type: string) {
    return { text, type };
}

export namespace Token {
    export namespace Comment {
        export const LeadingWhitespace = (text: string) => createToken(text, 'punctuation.whitespace.comment.leading.cs');

        export namespace MultiLine {
            export const End = createToken('*/', 'punctuation.definition.comment.cs');
            export const Start = createToken('/*', 'punctuation.definition.comment.cs');

            export const Text = (text: string) => createToken(text, 'comment.block.cs');
        }

        export namespace SingleLine {
            export const Start = createToken('//', 'punctuation.definition.comment.cs');

            export const Text = (text: string) => createToken(text, 'comment.line.double-slash.cs');
        }
    }

    export namespace Identifiers {
        export const AliasName = (text: string) => createToken(text, 'entity.name.type.alias.cs');
        export const ClassName = (text: string) => createToken(text, 'entity.name.type.class.cs');
        export const DelegateName = (text: string) => createToken(text, 'entity.name.type.delegate.cs');
        export const EnumName = (text: string) => createToken(text, 'entity.name.type.enum.cs');
        export const EventName = (text: string) => createToken(text, 'entity.name.variable.event.cs');
        export const FieldName = (text: string) => createToken(text, 'entity.name.variable.field.cs');
        export const InterfaceName = (text: string) => createToken(text, 'entity.name.type.interface.cs');
        export const LabelName = (text: string) => createToken(text, 'entity.name.label.cs');
        export const MethodName = (text: string) => createToken(text, 'entity.name.function.cs');
        export const NamespaceName = (text: string) => createToken(text, 'entity.name.type.namespace.cs');
        export const PropertyName = (text: string) => createToken(text, 'entity.name.variable.property.cs');
        export const StructName = (text: string) => createToken(text, 'entity.name.type.struct.cs');
    }

    export namespace Keywords {
        export namespace Modifiers {
            export const Abstract = createToken('abstract', 'storage.modifier.cs');
            export const Const = createToken('const', 'storage.modifier.cs');
            export const Internal = createToken('internal', 'storage.modifier.cs');
            export const New = createToken('new', 'storage.modifier.cs');
            export const Out = createToken('out', 'storage.modifier.cs');
            export const Params = createToken('params', 'storage.modifier.cs');
            export const Partial = createToken('partial', 'storage.modifier.cs');
            export const Private = createToken('private', 'storage.modifier.cs');
            export const Protected = createToken('protected', 'storage.modifier.cs');
            export const Public = createToken('public', 'storage.modifier.cs');
            export const ReadOnly = createToken('readonly', 'storage.modifier.cs');
            export const Ref = createToken('ref', 'storage.modifier.cs');
            export const Sealed = createToken('sealed', 'storage.modifier.cs');
            export const Static = createToken('static', 'storage.modifier.cs');
        }

        export const Add = createToken('add', 'keyword.other.add.cs');
        export const Alias = createToken('alias', 'keyword.other.alias.cs');
        export const AttributeSpecifier = (text: string) => createToken(text, 'keyword.other.attribute-specifier.cs');
        export const Base = createToken('base', 'keyword.other.base.cs');
        export const Break = createToken('break', 'keyword.control.flow.break.cs');
        export const Case = createToken('case', 'keyword.control.case.cs');
        export const Catch = createToken('catch', 'keyword.control.try.catch.cs');
        export const Checked = createToken('checked', 'keyword.other.checked.cs');
        export const Class = createToken('class', 'keyword.other.class.cs');
        export const Continue = createToken('continue', 'keyword.control.flow.continue.cs');
        export const Default = createToken('default', 'keyword.control.default.cs');
        export const Delegate = createToken('delegate', 'keyword.other.delegate.cs');
        export const Do = createToken('do', 'keyword.control.loop.do.cs');
        export const Else = createToken('else', 'keyword.control.conditional.else.cs');
        export const Enum = createToken('enum', 'keyword.other.enum.cs');
        export const Event = createToken('event', 'keyword.other.event.cs');
        export const Explicit = createToken('explicit', 'keyword.other.explicit.cs');
        export const Extern = createToken('extern', 'keyword.other.extern.cs');
        export const Finally = createToken('finally', 'keyword.control.try.finally.cs');
        export const For = createToken('for', 'keyword.control.loop.for.cs');
        export const ForEach = createToken('foreach', 'keyword.control.loop.foreach.cs');
        export const Get = createToken('get', 'keyword.other.get.cs');
        export const Goto = createToken('goto', 'keyword.control.goto.cs');
        export const If = createToken('if', 'keyword.control.conditional.if.cs');
        export const Implicit = createToken('implicit', 'keyword.other.implicit.cs');
        export const In = createToken('in', 'keyword.control.loop.in.cs');
        export const Interface = createToken('interface', 'keyword.other.interface.cs');
        export const Lock = createToken('lock', 'keyword.other.lock.cs');
        export const Namespace = createToken('namespace', 'keyword.other.namespace.cs');
        export const New = createToken('new', 'keyword.other.new.cs');
        export const Operator = createToken('operator', 'keyword.other.operator.cs');
        export const Remove = createToken('remove', 'keyword.other.remove.cs');
        export const Return = createToken('return', 'keyword.control.flow.return.cs');
        export const Set = createToken('set', 'keyword.other.set.cs');
        export const Static = createToken('static', 'keyword.other.static.cs');
        export const Struct = createToken('struct', 'keyword.other.struct.cs');
        export const Switch = createToken('switch', 'keyword.control.switch.cs');
        export const This = createToken('this', 'keyword.other.this.cs');
        export const Throw = createToken('throw', 'keyword.control.flow.throw.cs');
        export const Try = createToken('try', 'keyword.control.try.cs');
        export const Unchecked = createToken('unchecked', 'keyword.other.unchecked.cs');
        export const Using = createToken('using', 'keyword.other.using.cs');
        export const When = createToken('when', 'keyword.control.try.when.cs');
        export const Where = createToken('where', 'keyword.other.where.cs');
        export const While = createToken('while', 'keyword.control.loop.while.cs');
        export const Yield = createToken('yield', 'keyword.control.flow.yield.cs');
    }

    export namespace Literals {
        export namespace Boolean {
            export const False = createToken('false', 'constant.language.boolean.false.cs');
            export const True = createToken('true', 'constant.language.boolean.true.cs');
        }

        export const Null = createToken('null', 'constant.language.null.cs');

        export namespace Numeric {
            export const Binary = (text: string) => createToken(text, 'constant.numeric.binary.cs');
            export const Decimal = (text: string) => createToken(text, 'constant.numeric.decimal.cs');
            export const Hexadecimal = (text: string) => createToken(text, 'constant.numeric.hex.cs');
        }

        export const CharacterEscape = (text: string) => createToken(text, 'constant.character.escape.cs');
        export const String = (text: string) => createToken(text, 'string.quoted.double.cs');
    }

    export namespace Operators {
        export const Arrow = createToken('=>', 'keyword.operator.arrow.cs');

        export namespace Arithmetic {
            export const Addition = createToken('+', 'keyword.operator.arithmetic.cs');
            export const Division = createToken('/', 'keyword.operator.arithmetic.cs');
            export const Multiplication = createToken('*', 'keyword.operator.arithmetic.cs');
            export const Remainder = createToken('%', 'keyword.operator.arithmetic.cs');
            export const Subtraction = createToken('-', 'keyword.operator.arithmetic.cs');
        }

        export const Assignment = createToken('=', 'keyword.operator.assignment.cs');

        export namespace Bitwise {
            export const And = createToken('&', 'keyword.operator.bitwise.cs');
            export const BitwiseComplement = createToken('~', 'keyword.operator.bitwise.cs');
            export const ExclusiveOr = createToken('^', 'keyword.operator.bitwise.cs');
            export const Or = createToken('|', 'keyword.operator.bitwise.cs');
            export const ShiftLeft = createToken('<<', 'keyword.operator.bitwise.shift.cs');
            export const ShiftRight = createToken('>>', 'keyword.operator.bitwise.shift.cs');
       }

        export const Decrement = createToken('--', 'keyword.operator.decrement.cs');
        export const Increment = createToken('++', 'keyword.operator.increment.cs');

        export namespace Logical {
            export const And = createToken('&&', 'keyword.operator.logical.cs');
            export const Not = createToken('!', 'keyword.operator.logical.cs');
            export const Or = createToken('||', 'keyword.operator.logical.cs');
       }

        export namespace Relational {
            export const Equals = createToken('==', 'keyword.operator.comparison.cs');
            export const NotEqual = createToken('!=', 'keyword.operator.comparison.cs');

            export const LessThan = createToken('<', 'keyword.operator.relational.cs');
            export const LessThanOrEqual = createToken('<=', 'keyword.operator.relational.cs');
            export const GreaterThan = createToken('>', 'keyword.operator.relational.cs');
            export const GreaterThanOrEqual = createToken('>=', 'keyword.operator.relational.cs');
       }
    }

    export namespace Punctuation {
        export const Accessor = createToken('.', 'punctuation.accessor.cs');
        export const CloseBrace = createToken('}', 'punctuation.curlybrace.close.cs');
        export const CloseBracket = createToken(']', 'punctuation.squarebracket.close.cs');
        export const CloseParen = createToken(')', 'punctuation.parenthesis.close.cs');
        export const Colon = createToken(':', 'punctuation.separator.colon.cs');
        export const ColonColon = createToken('::', 'punctuation.separator.coloncolon.cs');
        export const Comma = createToken(',', 'punctuation.separator.comma.cs');
        export const OpenBrace = createToken('{', 'punctuation.curlybrace.open.cs');
        export const OpenBracket = createToken('[', 'punctuation.squarebracket.open.cs');
        export const OpenParen = createToken('(', 'punctuation.parenthesis.open.cs');

        export namespace Interpolation {
            export const Begin = createToken('{', 'punctuation.definition.interpolation.begin.cs');
            export const End = createToken('}', 'punctuation.definition.interpolation.end.cs');
        }

        export namespace InterpolatedString {
            export const Begin = createToken('$"', 'punctuation.definition.string.begin.cs');
            export const End = createToken('"', 'punctuation.definition.string.end.cs');
            export const VerbatimBegin = createToken('$@"', 'punctuation.definition.string.begin.cs');
        }

        export const Semicolon = createToken(';', 'punctuation.terminator.statement.cs');

        export namespace String {
            export const Begin = createToken('"', 'punctuation.definition.string.begin.cs');
            export const End = createToken('"', 'punctuation.definition.string.end.cs');
            export const VerbatimBegin = createToken('@"', 'punctuation.definition.string.begin.cs');
        }

        export namespace TypeParameters {
            export const Begin = createToken('<', 'punctuation.definition.typeparameters.begin.cs');
            export const End = createToken('>', 'punctuation.definition.typeparameters.end.cs');
        }

        export const Tilde = createToken('~', 'punctuation.tilde.cs');
    }

    export namespace Variables {
        export const Alias = (text: string) => createToken(text, 'variable.other.alias.cs');
        export const EnumMember = (text: string) => createToken(text, 'variable.other.enummember.cs');
        export const Local = (text: string) => createToken(text, 'variable.local.cs');
        export const Object = (text: string) => createToken(text, 'variable.other.object.cs');
        export const Property = (text: string) => createToken(text, 'variable.other.object.property.cs');
        export const Parameter = (text: string) => createToken(text, 'variable.parameter.cs');
        export const ReadWrite = (text: string) => createToken(text, 'variable.other.readwrite.cs');
        export const Tuple = (text: string) => createToken(text, 'entity.name.variable.tuple.cs');
    }

    export const IllegalNewLine = (text: string) => createToken(text, 'invalid.illegal.newline.cs');
    export const Type = (text: string) => createToken(text, 'storage.type.cs');
}
