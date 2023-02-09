/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { SemanticTokenTypes } from 'vscode-languageserver-protocol';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { createRequest, toRange2 } from '../omnisharp/typeConversion';
import AbstractProvider from './abstractProvider';
import { OmniSharpServer } from '../omnisharp/server';
import OptionProvider from '../shared/observers/OptionProvider';
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';

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

enum CustomTokenType {
    plainKeyword = DefaultTokenType.label + 1,
    controlKeyword,
    operatorOverloaded,
    preprocessorKeyword,
    preprocessorText,
    excludedCode,
    punctuation,
    stringVerbatim,
    stringEscapeCharacter,
    delegate,
    module,
    extensionMethod,
    field,
    local,
    xmlDocCommentAttributeName,
    xmlDocCommentAttributeQuotes,
    xmlDocCommentAttributeValue,
    xmlDocCommentCDataSection,
    xmlDocCommentComment,
    xmlDocCommentDelimiter,
    xmlDocCommentEntityReference,
    xmlDocCommentName,
    xmlDocCommentProcessingInstruction,
    xmlDocCommentText,
    regexComment,
    regexCharacterClass,
    regexAnchor,
    regexQuantifier,
    regexGrouping,
    regexAlternation,
    regexSelfEscapedCharacter,
    regexOtherEscape,
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

enum SemanticHighlightModifier {
    Static
}

export default class OmniSharpSemanticTokensProvider extends AbstractProvider implements vscode.DocumentSemanticTokensProvider, vscode.DocumentRangeSemanticTokensProvider {

    constructor(server: OmniSharpServer, private optionProvider: OptionProvider, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
    }

    getLegend(): vscode.SemanticTokensLegend {
        return new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
    }

    async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens | null> {

        return this._provideSemanticTokens(document, undefined, token);
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

    async _provideSemanticTokens(document: vscode.TextDocument, range: protocol.V2.Range | undefined, token: vscode.CancellationToken): Promise<vscode.SemanticTokens | null> {
        // We can only semantically highlight file from disk.
        if (document.uri.scheme !== "file") {
            return null;
        }

        const options = this.optionProvider.GetLatestOptions();
        if (!options.omnisharpOptions.useSemanticHighlighting) {
            return null;
        }

        let req = createRequest<protocol.V2.SemanticHighlightRequest>(document, new vscode.Position(0, 0));
        req.Range = range;

        const versionBeforeRequest = document.version;

        const response = await serverUtils.getSemanticHighlights(this._server, req);

        const versionAfterRequest = document.version;

        if (versionBeforeRequest !== versionAfterRequest) {
            // cannot convert result's offsets to (line;col) values correctly
            // a new request will come in soon...
            //
            // here we cannot return null, because returning null would remove all semantic tokens.
            // we must throw to indicate that the semantic tokens should not be removed.
            // using the string busy here because it is not logged to error telemetry if the error text contains busy.
            throw new Error('busy');
        }

        const builder = new vscode.SemanticTokensBuilder();
        for (let span of response.Spans) {
            const tokenType = tokenTypeMap[span.Type];
            if (tokenType === undefined) {
                continue;
            }

            let tokenModifiers = span.Modifiers.reduce((modifiers, modifier) => modifiers + tokenModifierMap[modifier], 0);

            // We could add a separate classification for constants but they are
            // supported as a readonly variable. Until we start getting more complete
            // modifiers from the highlight service we can add the readonly modifier here.
            if (span.Type === SemanticHighlightClassification.ConstantName) {
                tokenModifiers += 2 ** DefaultTokenModifier.readonly;
            }

            // We can use the returned range because we made sure the document version is the same.
            let spanRange = toRange2(span);
            for (let line = spanRange.start.line; line <= spanRange.end.line; line++) {
                const startCharacter = (line === spanRange.start.line ? spanRange.start.character : 0);
                const endCharacter = (line === spanRange.end.line ? spanRange.end.character : document.lineAt(line).text.length);
                builder.push(line, startCharacter, endCharacter - startCharacter, tokenType, tokenModifiers);
            }
        }
        return builder.build();
    }
}

const tokenTypes: string[] = [];
tokenTypes[DefaultTokenType.comment] = SemanticTokenTypes.comment;
tokenTypes[DefaultTokenType.string] = SemanticTokenTypes.string;
tokenTypes[DefaultTokenType.keyword] = SemanticTokenTypes.keyword;
tokenTypes[DefaultTokenType.number] = SemanticTokenTypes.number;
tokenTypes[DefaultTokenType.regexp] = SemanticTokenTypes.regexp;
tokenTypes[DefaultTokenType.operator] = SemanticTokenTypes.operator;
tokenTypes[DefaultTokenType.namespace] = "namespace name";
tokenTypes[DefaultTokenType.type] = SemanticTokenTypes.type;
tokenTypes[DefaultTokenType.struct] = "struct name";
tokenTypes[DefaultTokenType.class] = "class name";
tokenTypes[DefaultTokenType.interface] = "interface name";
tokenTypes[DefaultTokenType.enum] = "enum name";
tokenTypes[DefaultTokenType.typeParameter] = "type parameter name";
tokenTypes[DefaultTokenType.function] = SemanticTokenTypes.function;
tokenTypes[DefaultTokenType.member] = 'method name';
tokenTypes[DefaultTokenType.macro] = SemanticTokenTypes.macro;
tokenTypes[DefaultTokenType.variable] = SemanticTokenTypes.variable;
tokenTypes[DefaultTokenType.parameter] = "parameter name";
tokenTypes[DefaultTokenType.property] = "property name";
tokenTypes[DefaultTokenType.enumMember] = 'enum member name';
tokenTypes[DefaultTokenType.event] = 'event name';
tokenTypes[DefaultTokenType.label] = 'label name';
tokenTypes[CustomTokenType.plainKeyword] = "keyword";
tokenTypes[CustomTokenType.controlKeyword] = "keyword - control";
tokenTypes[CustomTokenType.operatorOverloaded] = "operator - overloaded";
tokenTypes[CustomTokenType.preprocessorKeyword] = "preprocessor keyword";
tokenTypes[CustomTokenType.preprocessorText] = "preprocessor text";
tokenTypes[CustomTokenType.excludedCode] = "excluded code";
tokenTypes[CustomTokenType.punctuation] = "punctuation";
tokenTypes[CustomTokenType.stringVerbatim] = "string - verbatim";
tokenTypes[CustomTokenType.stringEscapeCharacter] = "string - escape character";
tokenTypes[CustomTokenType.delegate] = "delegate name";
tokenTypes[CustomTokenType.module] = "module name";
tokenTypes[CustomTokenType.extensionMethod] = "extension method name";
tokenTypes[CustomTokenType.field] = "field name";
tokenTypes[CustomTokenType.local] = "local name";
tokenTypes[CustomTokenType.xmlDocCommentAttributeName] = "xml doc comment - attribute name";
tokenTypes[CustomTokenType.xmlDocCommentAttributeQuotes] = "xml doc comment - attribute quotes";
tokenTypes[CustomTokenType.xmlDocCommentAttributeValue] = "xml doc comment - attribute value";
tokenTypes[CustomTokenType.xmlDocCommentCDataSection] = "xml doc comment - cdata section";
tokenTypes[CustomTokenType.xmlDocCommentComment] = "xml doc comment - comment";
tokenTypes[CustomTokenType.xmlDocCommentDelimiter] = "xml doc comment - delimiter";
tokenTypes[CustomTokenType.xmlDocCommentEntityReference] = "xml doc comment - entity reference";
tokenTypes[CustomTokenType.xmlDocCommentName] = "xml doc comment - name";
tokenTypes[CustomTokenType.xmlDocCommentProcessingInstruction] = "xml doc comment - processing instruction";
tokenTypes[CustomTokenType.xmlDocCommentText] = "xml doc comment - Text";
tokenTypes[CustomTokenType.regexComment] = "regex - comment";
tokenTypes[CustomTokenType.regexCharacterClass] = "regex - character class";
tokenTypes[CustomTokenType.regexAnchor] = "regex - anchor";
tokenTypes[CustomTokenType.regexQuantifier] = "regex - quantifier";
tokenTypes[CustomTokenType.regexGrouping] = "regex - grouping";
tokenTypes[CustomTokenType.regexAlternation] = "regex - alternation";
tokenTypes[CustomTokenType.regexSelfEscapedCharacter] = "regex - self escaped character";
tokenTypes[CustomTokenType.regexOtherEscape] = "regex - other escape";

const tokenModifiers: string[] = [];
tokenModifiers[DefaultTokenModifier.declaration] = 'declaration';
tokenModifiers[DefaultTokenModifier.static] = 'static';
tokenModifiers[DefaultTokenModifier.abstract] = 'abstract';
tokenModifiers[DefaultTokenModifier.deprecated] = 'deprecated';
tokenModifiers[DefaultTokenModifier.modification] = 'modification';
tokenModifiers[DefaultTokenModifier.async] = 'async';
tokenModifiers[DefaultTokenModifier.readonly] = 'readonly';

const tokenTypeMap: (number | undefined)[] = [];
tokenTypeMap[SemanticHighlightClassification.Comment] = DefaultTokenType.comment;
tokenTypeMap[SemanticHighlightClassification.ExcludedCode] = CustomTokenType.excludedCode;
tokenTypeMap[SemanticHighlightClassification.Identifier] = DefaultTokenType.variable;
tokenTypeMap[SemanticHighlightClassification.Keyword] = CustomTokenType.plainKeyword;
tokenTypeMap[SemanticHighlightClassification.ControlKeyword] = CustomTokenType.controlKeyword;
tokenTypeMap[SemanticHighlightClassification.NumericLiteral] = DefaultTokenType.number;
tokenTypeMap[SemanticHighlightClassification.Operator] = DefaultTokenType.operator;
tokenTypeMap[SemanticHighlightClassification.OperatorOverloaded] = CustomTokenType.operatorOverloaded;
tokenTypeMap[SemanticHighlightClassification.PreprocessorKeyword] = CustomTokenType.preprocessorKeyword;
tokenTypeMap[SemanticHighlightClassification.StringLiteral] = DefaultTokenType.string;
tokenTypeMap[SemanticHighlightClassification.WhiteSpace] = undefined;
tokenTypeMap[SemanticHighlightClassification.Text] = undefined;
tokenTypeMap[SemanticHighlightClassification.StaticSymbol] = undefined;
tokenTypeMap[SemanticHighlightClassification.PreprocessorText] = CustomTokenType.preprocessorText;
tokenTypeMap[SemanticHighlightClassification.Punctuation] = CustomTokenType.punctuation;
tokenTypeMap[SemanticHighlightClassification.VerbatimStringLiteral] = CustomTokenType.stringVerbatim;
tokenTypeMap[SemanticHighlightClassification.StringEscapeCharacter] = CustomTokenType.stringEscapeCharacter;
tokenTypeMap[SemanticHighlightClassification.ClassName] = DefaultTokenType.class;
tokenTypeMap[SemanticHighlightClassification.DelegateName] = CustomTokenType.delegate;
tokenTypeMap[SemanticHighlightClassification.EnumName] = DefaultTokenType.enum;
tokenTypeMap[SemanticHighlightClassification.InterfaceName] = DefaultTokenType.interface;
tokenTypeMap[SemanticHighlightClassification.ModuleName] = CustomTokenType.module;
tokenTypeMap[SemanticHighlightClassification.StructName] = DefaultTokenType.struct;
tokenTypeMap[SemanticHighlightClassification.TypeParameterName] = DefaultTokenType.typeParameter;
tokenTypeMap[SemanticHighlightClassification.FieldName] = CustomTokenType.field;
tokenTypeMap[SemanticHighlightClassification.EnumMemberName] = DefaultTokenType.enumMember;
tokenTypeMap[SemanticHighlightClassification.ConstantName] = DefaultTokenType.variable;
tokenTypeMap[SemanticHighlightClassification.LocalName] = CustomTokenType.local;
tokenTypeMap[SemanticHighlightClassification.ParameterName] = DefaultTokenType.parameter;
tokenTypeMap[SemanticHighlightClassification.MethodName] = DefaultTokenType.member;
tokenTypeMap[SemanticHighlightClassification.ExtensionMethodName] = CustomTokenType.extensionMethod;
tokenTypeMap[SemanticHighlightClassification.PropertyName] = DefaultTokenType.property;
tokenTypeMap[SemanticHighlightClassification.EventName] = DefaultTokenType.event;
tokenTypeMap[SemanticHighlightClassification.NamespaceName] = DefaultTokenType.namespace;
tokenTypeMap[SemanticHighlightClassification.LabelName] = DefaultTokenType.label;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentAttributeName] = CustomTokenType.xmlDocCommentAttributeName;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentAttributeQuotes] = CustomTokenType.xmlDocCommentAttributeQuotes;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentAttributeValue] = CustomTokenType.xmlDocCommentAttributeValue;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentCDataSection] = CustomTokenType.xmlDocCommentCDataSection;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentComment] = CustomTokenType.xmlDocCommentComment;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentDelimiter] = CustomTokenType.xmlDocCommentDelimiter;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentEntityReference] = CustomTokenType.xmlDocCommentEntityReference;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentName] = CustomTokenType.xmlDocCommentName;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentProcessingInstruction] = CustomTokenType.xmlDocCommentProcessingInstruction;
tokenTypeMap[SemanticHighlightClassification.XmlDocCommentText] = CustomTokenType.xmlDocCommentText;
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
tokenTypeMap[SemanticHighlightClassification.RegexComment] = CustomTokenType.regexComment;
tokenTypeMap[SemanticHighlightClassification.RegexCharacterClass] = CustomTokenType.regexCharacterClass;
tokenTypeMap[SemanticHighlightClassification.RegexAnchor] = CustomTokenType.regexAnchor;
tokenTypeMap[SemanticHighlightClassification.RegexQuantifier] = CustomTokenType.regexQuantifier;
tokenTypeMap[SemanticHighlightClassification.RegexGrouping] = CustomTokenType.regexGrouping;
tokenTypeMap[SemanticHighlightClassification.RegexAlternation] = CustomTokenType.regexAlternation;
tokenTypeMap[SemanticHighlightClassification.RegexText] = DefaultTokenType.regexp;
tokenTypeMap[SemanticHighlightClassification.RegexSelfEscapedCharacter] = CustomTokenType.regexSelfEscapedCharacter;
tokenTypeMap[SemanticHighlightClassification.RegexOtherEscape] = CustomTokenType.regexOtherEscape;

const tokenModifierMap: number[] = [];
tokenModifierMap[SemanticHighlightModifier.Static] = 2 ** DefaultTokenModifier.static;
