/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Proposed } from 'vscode-languageserver-protocol';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { createRequest } from '../omnisharp/typeConversion';
import AbstractProvider from './abstractProvider';

// The default TokenTypes defined by VS Code https://github.com/microsoft/vscode/blob/master/src/vs/platform/theme/common/tokenClassificationRegistry.ts#L393
enum DefaultTokenType {
    comment,
    string,
    keyword,
    number,
    regexp,
    operator,
    namespace,
    type,
    struct,
    class,
    interface,
    enum,
    typeParameter,
    function,
    member,
    macro,
    variable,
    parameter,
    property,
    enumMember,
    event,
    label,
}

enum CustomTokenTypes {
    plainKeyword = DefaultTokenType.label + 1,
    controlKeyword,
    operatorOverloaded,
    preprocessorKeyword,
    preprocessorText,
    punctuation,
    stringVerbatim,
    stringEscapeCharacter,
    delegate,
    module,
    extensionMethod,
    field,
    local
}

// The default TokenModifiers defined by VS Code https://github.com/microsoft/vscode/blob/master/src/vs/platform/theme/common/tokenClassificationRegistry.ts#L393
enum DefaultTokenModifier {
    declaration,
    static,
    abstract,
    deprecated,
    modification,
    async,
    readonly,
}

// All classifications from Roslyn's ClassificationTypeNames https://github.com/dotnet/roslyn/blob/master/src/Workspaces/Core/Portable/Classification/ClassificationTypeNames.cs
// Keep in sync with omnisharp-roslyn's SemanticHighlightClassification
enum SemanticHighlightClassification {
    Comment,
    ExcludedCode,
    Identifier,
    Keyword,
    ControlKeyword,
    NumericLiteral,
    Operator,
    OperatorOverloaded,
    PreprocessorKeyword,
    StringLiteral,
    WhiteSpace,
    Text,
    StaticSymbol,
    PreprocessorText,
    Punctuation,
    VerbatimStringLiteral,
    StringEscapeCharacter,
    ClassName,
    DelegateName,
    EnumName,
    InterfaceName,
    ModuleName,
    StructName,
    TypeParameterName,
    FieldName,
    EnumMemberName,
    ConstantName,
    LocalName,
    ParameterName,
    MethodName,
    ExtensionMethodName,
    PropertyName,
    EventName,
    NamespaceName,
    LabelName,
    XmlDocCommentAttributeName,
    XmlDocCommentAttributeQuotes,
    XmlDocCommentAttributeValue,
    XmlDocCommentCDataSection,
    XmlDocCommentComment,
    XmlDocCommentDelimiter,
    XmlDocCommentEntityReference,
    XmlDocCommentName,
    XmlDocCommentProcessingInstruction,
    XmlDocCommentText,
    XmlLiteralAttributeName,
    XmlLiteralAttributeQuotes,
    XmlLiteralAttributeValue,
    XmlLiteralCDataSection,
    XmlLiteralComment,
    XmlLiteralDelimiter,
    XmlLiteralEmbeddedExpression,
    XmlLiteralEntityReference,
    XmlLiteralName,
    XmlLiteralProcessingInstruction,
    XmlLiteralText,
    RegexComment,
    RegexCharacterClass,
    RegexAnchor,
    RegexQuantifier,
    RegexGrouping,
    RegexAlternation,
    RegexText,
    RegexSelfEscapedCharacter,
    RegexOtherEscape,
}

export default class SemanticTokensProvider extends AbstractProvider implements vscode.DocumentSemanticTokensProvider, vscode.DocumentRangeSemanticTokensProvider {

    getLegend(): vscode.SemanticTokensLegend {
        return new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
    }

    async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens | null> {

        return this._provideSemanticTokens(document, null, token);
    }

    async provideDocumentRangeSemanticTokens(document: vscode.TextDocument, range: vscode.Range, token: vscode.CancellationToken): Promise<vscode.SemanticTokens | null> {

        const v2Range: protocol.V2.Range = {
            Start: {
                Line: range.start.line,
                Column: range.start.character
            },
            End: {
                Line: range.end.line,
                Column: range.end.character
            }
        };
        return this._provideSemanticTokens(document, v2Range, token);
    }

    async _provideSemanticTokens(document: vscode.TextDocument, range: protocol.V2.Range, token: vscode.CancellationToken): Promise<vscode.SemanticTokens | null> {
        let req = createRequest<protocol.V2.SemanticHighlightRequest>(document, new vscode.Position(0, 0));
        req.Range = range;

        let response = await serverUtils.getSemanticHighlights(this._server, req);

        const semanticSpans = response.Spans;

        const builder = new vscode.SemanticTokensBuilder();
        for (let span of semanticSpans) {
            let tokenType = tokenTypeMap[span.Type];
            if (tokenType === undefined) {
                continue;
            }

            let tokenModifiers = tokenModifierMap[span.Type] ?? 0;

            for (let line = span.StartLine; line <= span.EndLine; line++) {
                const startCharacter = (line === span.StartLine ? span.StartColumn - 1 : 0);
                const endCharacter = (line === span.EndLine ? span.EndColumn - 1 : document.lineAt(line - 1).text.length);
                builder.push(line - 1, startCharacter, endCharacter - startCharacter, tokenType, tokenModifiers);
            }
        }
        return new vscode.SemanticTokens(builder.build());
    }
}

const tokenTypes: string[] = [];
tokenTypes[DefaultTokenType.comment] = Proposed.SemanticTokenTypes.comment;
tokenTypes[DefaultTokenType.string] = Proposed.SemanticTokenTypes.string;
tokenTypes[DefaultTokenType.keyword] = Proposed.SemanticTokenTypes.keyword;
tokenTypes[DefaultTokenType.number] = Proposed.SemanticTokenTypes.number;
tokenTypes[DefaultTokenType.regexp] = Proposed.SemanticTokenTypes.regexp;
tokenTypes[DefaultTokenType.operator] = Proposed.SemanticTokenTypes.operator;
tokenTypes[DefaultTokenType.namespace] = Proposed.SemanticTokenTypes.namespace;
tokenTypes[DefaultTokenType.type] = Proposed.SemanticTokenTypes.type;
tokenTypes[DefaultTokenType.struct] = Proposed.SemanticTokenTypes.struct;
tokenTypes[DefaultTokenType.class] = Proposed.SemanticTokenTypes.class;
tokenTypes[DefaultTokenType.interface] = Proposed.SemanticTokenTypes.interface;
tokenTypes[DefaultTokenType.enum] = Proposed.SemanticTokenTypes.enum;
tokenTypes[DefaultTokenType.typeParameter] = Proposed.SemanticTokenTypes.typeParameter;
tokenTypes[DefaultTokenType.function] = Proposed.SemanticTokenTypes.function;
tokenTypes[DefaultTokenType.member] = Proposed.SemanticTokenTypes.member;
tokenTypes[DefaultTokenType.macro] = Proposed.SemanticTokenTypes.macro;
tokenTypes[DefaultTokenType.variable] = Proposed.SemanticTokenTypes.variable;
tokenTypes[DefaultTokenType.parameter] = Proposed.SemanticTokenTypes.parameter;
tokenTypes[DefaultTokenType.property] = Proposed.SemanticTokenTypes.property;
tokenTypes[DefaultTokenType.enumMember] = 'enumMember';
tokenTypes[DefaultTokenType.event] = 'event';
tokenTypes[DefaultTokenType.label] = Proposed.SemanticTokenTypes.label;
tokenTypes[CustomTokenTypes.plainKeyword] = "plainKeyword";
tokenTypes[CustomTokenTypes.controlKeyword] = "controlKeyword";
tokenTypes[CustomTokenTypes.operatorOverloaded] = "operatorOverloaded";
tokenTypes[CustomTokenTypes.preprocessorKeyword] = "preprocessorKeyword";
tokenTypes[CustomTokenTypes.preprocessorText] = "preprocessorText";
tokenTypes[CustomTokenTypes.punctuation] = "punctuation";
tokenTypes[CustomTokenTypes.stringVerbatim] = "stringVerbatim";
tokenTypes[CustomTokenTypes.stringEscapeCharacter] = "stringEscapeCharacter";
tokenTypes[CustomTokenTypes.delegate] = "delegate";
tokenTypes[CustomTokenTypes.module] = "module";
tokenTypes[CustomTokenTypes.extensionMethod] = "extensionMethod";
tokenTypes[CustomTokenTypes.field] = "field";
tokenTypes[CustomTokenTypes.local] = "local";

const tokenModifiers: string[] = [];
tokenModifiers[DefaultTokenModifier.declaration] = 'declaration';
tokenModifiers[DefaultTokenModifier.static] = 'static';
tokenModifiers[DefaultTokenModifier.abstract] = 'abstract';
tokenModifiers[DefaultTokenModifier.deprecated] = 'deprecated';
tokenModifiers[DefaultTokenModifier.modification] = 'modification';
tokenModifiers[DefaultTokenModifier.async] = 'async';
tokenModifiers[DefaultTokenModifier.readonly] = 'readonly';

const tokenTypeMap: number[] = [];
tokenTypeMap[SemanticHighlightClassification.Comment] = DefaultTokenType.comment;
tokenTypeMap[SemanticHighlightClassification.ExcludedCode] = undefined;
tokenTypeMap[SemanticHighlightClassification.Identifier] = DefaultTokenType.variable;
tokenTypeMap[SemanticHighlightClassification.Keyword] = CustomTokenTypes.plainKeyword;
tokenTypeMap[SemanticHighlightClassification.ControlKeyword] = CustomTokenTypes.controlKeyword;
tokenTypeMap[SemanticHighlightClassification.NumericLiteral] = DefaultTokenType.number;
tokenTypeMap[SemanticHighlightClassification.Operator] = DefaultTokenType.operator;
tokenTypeMap[SemanticHighlightClassification.OperatorOverloaded] = CustomTokenTypes.operatorOverloaded;
tokenTypeMap[SemanticHighlightClassification.PreprocessorKeyword] = CustomTokenTypes.preprocessorKeyword;
tokenTypeMap[SemanticHighlightClassification.StringLiteral] = DefaultTokenType.string;
tokenTypeMap[SemanticHighlightClassification.WhiteSpace] = undefined;
tokenTypeMap[SemanticHighlightClassification.Text] = undefined;
tokenTypeMap[SemanticHighlightClassification.StaticSymbol] = undefined;
tokenTypeMap[SemanticHighlightClassification.PreprocessorText] = CustomTokenTypes.preprocessorText;
tokenTypeMap[SemanticHighlightClassification.Punctuation] = CustomTokenTypes.punctuation;
tokenTypeMap[SemanticHighlightClassification.VerbatimStringLiteral] = CustomTokenTypes.stringVerbatim;
tokenTypeMap[SemanticHighlightClassification.StringEscapeCharacter] = CustomTokenTypes.stringEscapeCharacter;
tokenTypeMap[SemanticHighlightClassification.ClassName] = DefaultTokenType.class;
tokenTypeMap[SemanticHighlightClassification.DelegateName] = CustomTokenTypes.delegate;
tokenTypeMap[SemanticHighlightClassification.EnumName] = DefaultTokenType.enum;
tokenTypeMap[SemanticHighlightClassification.InterfaceName] = DefaultTokenType.interface;
tokenTypeMap[SemanticHighlightClassification.ModuleName] = CustomTokenTypes.module;
tokenTypeMap[SemanticHighlightClassification.StructName] = DefaultTokenType.struct;
tokenTypeMap[SemanticHighlightClassification.TypeParameterName] = DefaultTokenType.typeParameter;
tokenTypeMap[SemanticHighlightClassification.FieldName] = CustomTokenTypes.field;
tokenTypeMap[SemanticHighlightClassification.EnumMemberName] = DefaultTokenType.enumMember;
tokenTypeMap[SemanticHighlightClassification.ConstantName] = DefaultTokenType.variable;
tokenTypeMap[SemanticHighlightClassification.LocalName] = CustomTokenTypes.local;
tokenTypeMap[SemanticHighlightClassification.ParameterName] = DefaultTokenType.parameter;
tokenTypeMap[SemanticHighlightClassification.MethodName] = DefaultTokenType.member;
tokenTypeMap[SemanticHighlightClassification.ExtensionMethodName] = CustomTokenTypes.extensionMethod;
tokenTypeMap[SemanticHighlightClassification.PropertyName] = DefaultTokenType.property;
tokenTypeMap[SemanticHighlightClassification.EventName] = DefaultTokenType.event;
tokenTypeMap[SemanticHighlightClassification.NamespaceName] = DefaultTokenType.namespace;
tokenTypeMap[SemanticHighlightClassification.LabelName] = DefaultTokenType.label;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentAttributeName] = DefaultTokenType.comment;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentAttributeQuotes] = DefaultTokenType.comment;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentAttributeValue] = DefaultTokenType.comment;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentCDataSection] = DefaultTokenType.comment;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentComment] = DefaultTokenType.comment;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentDelimiter] = DefaultTokenType.comment;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentEntityReference] = DefaultTokenType.comment;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentName] = DefaultTokenType.comment;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentProcessingInstruction] = DefaultTokenType.comment;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentText] = DefaultTokenType.comment;
tokenTypeMap[SemanticHighlightClassification.XmlLiteralAttributeName] = undefined;
tokenTypeMap[SemanticHighlightClassification.XmlLiteralAttributeQuotes] = undefined;
tokenTypeMap[SemanticHighlightClassification.XmlLiteralAttributeValue] = undefined;
tokenTypeMap[SemanticHighlightClassification.XmlLiteralCDataSection] = undefined;
tokenTypeMap[SemanticHighlightClassification.XmlLiteralComment] = undefined;
tokenTypeMap[SemanticHighlightClassification.XmlLiteralDelimiter] = undefined;
tokenTypeMap[SemanticHighlightClassification.XmlLiteralEmbeddedExpression] = undefined;
tokenTypeMap[SemanticHighlightClassification.XmlLiteralEntityReference] = undefined;
tokenTypeMap[SemanticHighlightClassification.XmlLiteralName] = undefined;
tokenTypeMap[SemanticHighlightClassification.XmlLiteralProcessingInstruction] = undefined;
tokenTypeMap[SemanticHighlightClassification.XmlLiteralText] = undefined;
tokenTypeMap[SemanticHighlightClassification.RegexComment] = DefaultTokenType.regexp;
tokenTypeMap[SemanticHighlightClassification.RegexCharacterClass] = DefaultTokenType.regexp;
tokenTypeMap[SemanticHighlightClassification.RegexAnchor] = DefaultTokenType.regexp;
tokenTypeMap[SemanticHighlightClassification.RegexQuantifier] = DefaultTokenType.regexp;
tokenTypeMap[SemanticHighlightClassification.RegexGrouping] = DefaultTokenType.regexp;
tokenTypeMap[SemanticHighlightClassification.RegexAlternation] = DefaultTokenType.regexp;
tokenTypeMap[SemanticHighlightClassification.RegexText] = DefaultTokenType.regexp;
tokenTypeMap[SemanticHighlightClassification.RegexSelfEscapedCharacter] = DefaultTokenType.regexp;
tokenTypeMap[SemanticHighlightClassification.RegexOtherEscape] = DefaultTokenType.regexp;

const tokenModifierMap: number[] = [];
tokenModifierMap[SemanticHighlightClassification.Comment] = undefined;
tokenModifierMap[SemanticHighlightClassification.ExcludedCode] = undefined;
tokenModifierMap[SemanticHighlightClassification.Identifier] = undefined;
tokenModifierMap[SemanticHighlightClassification.Keyword] = undefined;
tokenModifierMap[SemanticHighlightClassification.ControlKeyword] = undefined;
tokenModifierMap[SemanticHighlightClassification.NumericLiteral] = undefined;
tokenModifierMap[SemanticHighlightClassification.Operator] = undefined;
tokenModifierMap[SemanticHighlightClassification.OperatorOverloaded] = undefined;
tokenModifierMap[SemanticHighlightClassification.PreprocessorKeyword] = undefined;
tokenModifierMap[SemanticHighlightClassification.StringLiteral] = undefined;
tokenModifierMap[SemanticHighlightClassification.WhiteSpace] = undefined;
tokenModifierMap[SemanticHighlightClassification.Text] = undefined;
tokenModifierMap[SemanticHighlightClassification.StaticSymbol] = undefined;
tokenModifierMap[SemanticHighlightClassification.PreprocessorText] = undefined;
tokenModifierMap[SemanticHighlightClassification.Punctuation] = undefined;
tokenModifierMap[SemanticHighlightClassification.VerbatimStringLiteral] = undefined;
tokenModifierMap[SemanticHighlightClassification.StringEscapeCharacter] = undefined;
tokenModifierMap[SemanticHighlightClassification.ClassName] = undefined;
tokenModifierMap[SemanticHighlightClassification.DelegateName] = undefined;
tokenModifierMap[SemanticHighlightClassification.EnumName] = undefined;
tokenModifierMap[SemanticHighlightClassification.InterfaceName] = undefined;
tokenModifierMap[SemanticHighlightClassification.ModuleName] = undefined;
tokenModifierMap[SemanticHighlightClassification.StructName] = undefined;
tokenModifierMap[SemanticHighlightClassification.TypeParameterName] = undefined;
tokenModifierMap[SemanticHighlightClassification.FieldName] = undefined;
tokenModifierMap[SemanticHighlightClassification.EnumMemberName] = undefined;
tokenModifierMap[SemanticHighlightClassification.ConstantName] = 2 ** DefaultTokenModifier.readonly;
tokenModifierMap[SemanticHighlightClassification.LocalName] = undefined;
tokenModifierMap[SemanticHighlightClassification.ParameterName] = undefined;
tokenModifierMap[SemanticHighlightClassification.MethodName] = undefined;
tokenModifierMap[SemanticHighlightClassification.ExtensionMethodName] = undefined;
tokenModifierMap[SemanticHighlightClassification.PropertyName] = undefined;
tokenModifierMap[SemanticHighlightClassification.EventName] = undefined;
tokenModifierMap[SemanticHighlightClassification.NamespaceName] = undefined;
tokenModifierMap[SemanticHighlightClassification.LabelName] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlDocCommentAttributeName] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlDocCommentAttributeQuotes] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlDocCommentAttributeValue] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlDocCommentCDataSection] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlDocCommentComment] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlDocCommentDelimiter] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlDocCommentEntityReference] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlDocCommentName] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlDocCommentProcessingInstruction] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlDocCommentText] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlLiteralAttributeName] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlLiteralAttributeQuotes] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlLiteralAttributeValue] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlLiteralCDataSection] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlLiteralComment] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlLiteralDelimiter] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlLiteralEmbeddedExpression] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlLiteralEntityReference] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlLiteralName] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlLiteralProcessingInstruction] = undefined;
tokenModifierMap[SemanticHighlightClassification.XmlLiteralText] = undefined;
tokenModifierMap[SemanticHighlightClassification.RegexComment] = undefined;
tokenModifierMap[SemanticHighlightClassification.RegexCharacterClass] = undefined;
tokenModifierMap[SemanticHighlightClassification.RegexAnchor] = undefined;
tokenModifierMap[SemanticHighlightClassification.RegexQuantifier] = undefined;
tokenModifierMap[SemanticHighlightClassification.RegexGrouping] = undefined;
tokenModifierMap[SemanticHighlightClassification.RegexAlternation] = undefined;
tokenModifierMap[SemanticHighlightClassification.RegexText] = undefined;
tokenModifierMap[SemanticHighlightClassification.RegexSelfEscapedCharacter] = undefined;
tokenModifierMap[SemanticHighlightClassification.RegexOtherEscape] = undefined;
