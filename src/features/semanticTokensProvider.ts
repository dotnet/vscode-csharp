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
import OptionProvider from '../shared/observers/optionProvider';
import { LanguageMiddlewareFeature } from '../omnisharp/languageMiddlewareFeature';

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
    controlKeyword = DefaultTokenType.label + 1,
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
    Static,
}

export default class OmniSharpSemanticTokensProvider
    extends AbstractProvider
    implements vscode.DocumentSemanticTokensProvider, vscode.DocumentRangeSemanticTokensProvider
{
    constructor(
        server: OmniSharpServer,
        private optionProvider: OptionProvider,
        languageMiddlewareFeature: LanguageMiddlewareFeature
    ) {
        super(server, languageMiddlewareFeature);
    }

    getLegend(): vscode.SemanticTokensLegend {
        return new vscode.SemanticTokensLegend(tokenLegendMap, tokenModifiersLegend);
    }

    async provideDocumentSemanticTokens(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<vscode.SemanticTokens | null> {
        return this._provideSemanticTokens(document, undefined, token);
    }

    async provideDocumentRangeSemanticTokens(
        document: vscode.TextDocument,
        range: vscode.Range,
        token: vscode.CancellationToken
    ): Promise<vscode.SemanticTokens | null> {
        const v2Range: protocol.V2.Range = {
            Start: {
                Line: range.start.line,
                Column: range.start.character,
            },
            End: {
                Line: range.end.line,
                Column: range.end.character,
            },
        };
        return this._provideSemanticTokens(document, v2Range, token);
    }

    async _provideSemanticTokens(
        document: vscode.TextDocument,
        range: protocol.V2.Range | undefined,
        _: vscode.CancellationToken
    ): Promise<vscode.SemanticTokens | null> {
        // We can only semantically highlight file from disk.
        if (document.uri.scheme !== 'file') {
            return null;
        }

        const options = this.optionProvider.GetLatestOptions();
        if (!options.omnisharpOptions.useSemanticHighlighting) {
            return null;
        }

        const req = createRequest<protocol.V2.SemanticHighlightRequest>(document, new vscode.Position(0, 0));
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
        for (const span of response.Spans) {
            const tokenType = classificationToToken[span.Type];
            if (tokenType === undefined) {
                continue;
            }

            let tokenModifiers = span.Modifiers.reduce(
                (modifiers, modifier) => modifiers + classificationModifierToTokenModifier[modifier],
                0
            );

            // We could add a separate classification for constants but they are
            // supported as a readonly variable. Until we start getting more complete
            // modifiers from the highlight service we can add the readonly modifier here.
            if (span.Type === SemanticHighlightClassification.ConstantName) {
                tokenModifiers += 2 ** DefaultTokenModifier.readonly;
            }

            // We can use the returned range because we made sure the document version is the same.
            const spanRange = toRange2(span);
            for (let line = spanRange.start.line; line <= spanRange.end.line; line++) {
                const startCharacter = line === spanRange.start.line ? spanRange.start.character : 0;
                const endCharacter =
                    line === spanRange.end.line ? spanRange.end.character : document.lineAt(line).text.length;
                builder.push(line, startCharacter, endCharacter - startCharacter, tokenType, tokenModifiers);
            }
        }
        return builder.build();
    }
}

// Defines the legend that maps from a token int to a token name in order to colorize the tokens.
// The token names are mapped to semantic token names or custom textmate scopes in the package.json
const tokenLegendMap: string[] = [];
tokenLegendMap[DefaultTokenType.comment] = SemanticTokenTypes.comment;
tokenLegendMap[DefaultTokenType.string] = SemanticTokenTypes.string;
tokenLegendMap[DefaultTokenType.keyword] = SemanticTokenTypes.keyword;
tokenLegendMap[DefaultTokenType.number] = SemanticTokenTypes.number;
tokenLegendMap[DefaultTokenType.regexp] = SemanticTokenTypes.regexp;
tokenLegendMap[DefaultTokenType.operator] = SemanticTokenTypes.operator;
tokenLegendMap[DefaultTokenType.namespace] = SemanticTokenTypes.namespace;
tokenLegendMap[DefaultTokenType.type] = SemanticTokenTypes.type;
tokenLegendMap[DefaultTokenType.struct] = SemanticTokenTypes.struct;
tokenLegendMap[DefaultTokenType.class] = SemanticTokenTypes.class;
tokenLegendMap[DefaultTokenType.interface] = SemanticTokenTypes.interface;
tokenLegendMap[DefaultTokenType.enum] = SemanticTokenTypes.enum;
tokenLegendMap[DefaultTokenType.typeParameter] = SemanticTokenTypes.typeParameter;
tokenLegendMap[DefaultTokenType.function] = SemanticTokenTypes.function;
tokenLegendMap[DefaultTokenType.member] = SemanticTokenTypes.method;
tokenLegendMap[DefaultTokenType.macro] = SemanticTokenTypes.macro;
tokenLegendMap[DefaultTokenType.variable] = SemanticTokenTypes.variable;
tokenLegendMap[DefaultTokenType.parameter] = SemanticTokenTypes.parameter;
tokenLegendMap[DefaultTokenType.property] = SemanticTokenTypes.property;
tokenLegendMap[DefaultTokenType.enumMember] = SemanticTokenTypes.enumMember;
tokenLegendMap[DefaultTokenType.event] = SemanticTokenTypes.event;
tokenLegendMap[DefaultTokenType.label] = 'label';
tokenLegendMap[CustomTokenType.controlKeyword] = 'controlKeyword';
tokenLegendMap[CustomTokenType.operatorOverloaded] = 'operatorOverloaded';
tokenLegendMap[CustomTokenType.preprocessorKeyword] = SemanticTokenTypes.macro;
tokenLegendMap[CustomTokenType.preprocessorText] = 'preprocessorText';
tokenLegendMap[CustomTokenType.excludedCode] = 'excludedCode';
tokenLegendMap[CustomTokenType.punctuation] = 'punctuation';
tokenLegendMap[CustomTokenType.stringVerbatim] = 'stringVerbatim';
tokenLegendMap[CustomTokenType.stringEscapeCharacter] = 'stringEscapeCharacter';
tokenLegendMap[CustomTokenType.delegate] = 'delegate';
tokenLegendMap[CustomTokenType.module] = 'module';
tokenLegendMap[CustomTokenType.extensionMethod] = 'extensionMethod';
tokenLegendMap[CustomTokenType.field] = 'field';
tokenLegendMap[CustomTokenType.local] = SemanticTokenTypes.variable;
tokenLegendMap[CustomTokenType.xmlDocCommentAttributeName] = 'xmlDocCommentAttributeName';
tokenLegendMap[CustomTokenType.xmlDocCommentAttributeQuotes] = 'xmlDocCommentAttributeQuotes';
tokenLegendMap[CustomTokenType.xmlDocCommentAttributeValue] = 'xmlDocCommentAttributeValue';
tokenLegendMap[CustomTokenType.xmlDocCommentCDataSection] = 'xmlDocCommentCDataSection';
tokenLegendMap[CustomTokenType.xmlDocCommentComment] = 'xmlDocCommentComment';
tokenLegendMap[CustomTokenType.xmlDocCommentDelimiter] = 'xmlDocCommentDelimiter';
tokenLegendMap[CustomTokenType.xmlDocCommentEntityReference] = 'xmlDocCommentEntityReference';
tokenLegendMap[CustomTokenType.xmlDocCommentName] = 'xmlDocCommentName';
tokenLegendMap[CustomTokenType.xmlDocCommentProcessingInstruction] = 'xmlDocCommentProcessingInstruction';
tokenLegendMap[CustomTokenType.xmlDocCommentText] = 'xmlDocCommentText';
tokenLegendMap[CustomTokenType.regexComment] = 'regexComment';
tokenLegendMap[CustomTokenType.regexCharacterClass] = 'regexCharacterClass';
tokenLegendMap[CustomTokenType.regexAnchor] = 'regexAnchor';
tokenLegendMap[CustomTokenType.regexQuantifier] = 'regexQuantifier';
tokenLegendMap[CustomTokenType.regexGrouping] = 'regexGrouping';
tokenLegendMap[CustomTokenType.regexAlternation] = 'regexAlternation';
tokenLegendMap[CustomTokenType.regexSelfEscapedCharacter] = 'regexText';
tokenLegendMap[CustomTokenType.regexOtherEscape] = 'regexSelfEscapedCharacter';

const tokenModifiersLegend: string[] = [];
tokenModifiersLegend[DefaultTokenModifier.declaration] = 'declaration';
tokenModifiersLegend[DefaultTokenModifier.static] = 'static';
tokenModifiersLegend[DefaultTokenModifier.abstract] = 'abstract';
tokenModifiersLegend[DefaultTokenModifier.deprecated] = 'deprecated';
tokenModifiersLegend[DefaultTokenModifier.modification] = 'modification';
tokenModifiersLegend[DefaultTokenModifier.async] = 'async';
tokenModifiersLegend[DefaultTokenModifier.readonly] = 'readonly';

// Maps from the semantic classification types returned from the server to client side token type integers.
// The token type integers are mapped to colors via the tokenLegendMap.
const classificationToToken: (number | undefined)[] = [];
classificationToToken[SemanticHighlightClassification.Comment] = DefaultTokenType.comment;
classificationToToken[SemanticHighlightClassification.ExcludedCode] = CustomTokenType.excludedCode;
classificationToToken[SemanticHighlightClassification.Identifier] = DefaultTokenType.variable;
classificationToToken[SemanticHighlightClassification.Keyword] = DefaultTokenType.keyword;
classificationToToken[SemanticHighlightClassification.ControlKeyword] = CustomTokenType.controlKeyword;
classificationToToken[SemanticHighlightClassification.NumericLiteral] = DefaultTokenType.number;
classificationToToken[SemanticHighlightClassification.Operator] = DefaultTokenType.operator;
classificationToToken[SemanticHighlightClassification.OperatorOverloaded] = CustomTokenType.operatorOverloaded;
classificationToToken[SemanticHighlightClassification.PreprocessorKeyword] = CustomTokenType.preprocessorKeyword;
classificationToToken[SemanticHighlightClassification.StringLiteral] = DefaultTokenType.string;
classificationToToken[SemanticHighlightClassification.WhiteSpace] = undefined;
classificationToToken[SemanticHighlightClassification.Text] = undefined;
classificationToToken[SemanticHighlightClassification.StaticSymbol] = undefined;
classificationToToken[SemanticHighlightClassification.PreprocessorText] = CustomTokenType.preprocessorText;
classificationToToken[SemanticHighlightClassification.Punctuation] = CustomTokenType.punctuation;
classificationToToken[SemanticHighlightClassification.VerbatimStringLiteral] = CustomTokenType.stringVerbatim;
classificationToToken[SemanticHighlightClassification.StringEscapeCharacter] = CustomTokenType.stringEscapeCharacter;
classificationToToken[SemanticHighlightClassification.ClassName] = DefaultTokenType.class;
classificationToToken[SemanticHighlightClassification.DelegateName] = CustomTokenType.delegate;
classificationToToken[SemanticHighlightClassification.EnumName] = DefaultTokenType.enum;
classificationToToken[SemanticHighlightClassification.InterfaceName] = DefaultTokenType.interface;
classificationToToken[SemanticHighlightClassification.ModuleName] = CustomTokenType.module;
classificationToToken[SemanticHighlightClassification.StructName] = DefaultTokenType.struct;
classificationToToken[SemanticHighlightClassification.TypeParameterName] = DefaultTokenType.typeParameter;
classificationToToken[SemanticHighlightClassification.FieldName] = CustomTokenType.field;
classificationToToken[SemanticHighlightClassification.EnumMemberName] = DefaultTokenType.enumMember;
classificationToToken[SemanticHighlightClassification.ConstantName] = DefaultTokenType.variable;
classificationToToken[SemanticHighlightClassification.LocalName] = CustomTokenType.local;
classificationToToken[SemanticHighlightClassification.ParameterName] = DefaultTokenType.parameter;
classificationToToken[SemanticHighlightClassification.MethodName] = DefaultTokenType.member;
classificationToToken[SemanticHighlightClassification.ExtensionMethodName] = CustomTokenType.extensionMethod;
classificationToToken[SemanticHighlightClassification.PropertyName] = DefaultTokenType.property;
classificationToToken[SemanticHighlightClassification.EventName] = DefaultTokenType.event;
classificationToToken[SemanticHighlightClassification.NamespaceName] = DefaultTokenType.namespace;
classificationToToken[SemanticHighlightClassification.LabelName] = DefaultTokenType.label;
classificationToToken[SemanticHighlightClassification.XmlDocCommentAttributeName] =
    CustomTokenType.xmlDocCommentAttributeName;
classificationToToken[SemanticHighlightClassification.XmlDocCommentAttributeQuotes] =
    CustomTokenType.xmlDocCommentAttributeQuotes;
classificationToToken[SemanticHighlightClassification.XmlDocCommentAttributeValue] =
    CustomTokenType.xmlDocCommentAttributeValue;
classificationToToken[SemanticHighlightClassification.XmlDocCommentCDataSection] =
    CustomTokenType.xmlDocCommentCDataSection;
classificationToToken[SemanticHighlightClassification.XmlDocCommentComment] = CustomTokenType.xmlDocCommentComment;
classificationToToken[SemanticHighlightClassification.XmlDocCommentDelimiter] = CustomTokenType.xmlDocCommentDelimiter;
classificationToToken[SemanticHighlightClassification.XmlDocCommentEntityReference] =
    CustomTokenType.xmlDocCommentEntityReference;
classificationToToken[SemanticHighlightClassification.XmlDocCommentName] = CustomTokenType.xmlDocCommentName;
classificationToToken[SemanticHighlightClassification.XmlDocCommentProcessingInstruction] =
    CustomTokenType.xmlDocCommentProcessingInstruction;
classificationToToken[SemanticHighlightClassification.XmlDocCommentText] = CustomTokenType.xmlDocCommentText;
classificationToToken[SemanticHighlightClassification.XmlLiteralAttributeName] = undefined;
classificationToToken[SemanticHighlightClassification.XmlLiteralAttributeQuotes] = undefined;
classificationToToken[SemanticHighlightClassification.XmlLiteralAttributeValue] = undefined;
classificationToToken[SemanticHighlightClassification.XmlLiteralCDataSection] = undefined;
classificationToToken[SemanticHighlightClassification.XmlLiteralComment] = undefined;
classificationToToken[SemanticHighlightClassification.XmlLiteralDelimiter] = undefined;
classificationToToken[SemanticHighlightClassification.XmlLiteralEmbeddedExpression] = undefined;
classificationToToken[SemanticHighlightClassification.XmlLiteralEntityReference] = undefined;
classificationToToken[SemanticHighlightClassification.XmlLiteralName] = undefined;
classificationToToken[SemanticHighlightClassification.XmlLiteralProcessingInstruction] = undefined;
classificationToToken[SemanticHighlightClassification.XmlLiteralText] = undefined;
classificationToToken[SemanticHighlightClassification.RegexComment] = CustomTokenType.regexComment;
classificationToToken[SemanticHighlightClassification.RegexCharacterClass] = CustomTokenType.regexCharacterClass;
classificationToToken[SemanticHighlightClassification.RegexAnchor] = CustomTokenType.regexAnchor;
classificationToToken[SemanticHighlightClassification.RegexQuantifier] = CustomTokenType.regexQuantifier;
classificationToToken[SemanticHighlightClassification.RegexGrouping] = CustomTokenType.regexGrouping;
classificationToToken[SemanticHighlightClassification.RegexAlternation] = CustomTokenType.regexAlternation;
classificationToToken[SemanticHighlightClassification.RegexText] = DefaultTokenType.regexp;
classificationToToken[SemanticHighlightClassification.RegexSelfEscapedCharacter] =
    CustomTokenType.regexSelfEscapedCharacter;
classificationToToken[SemanticHighlightClassification.RegexOtherEscape] = CustomTokenType.regexOtherEscape;

const classificationModifierToTokenModifier: number[] = [];
classificationModifierToTokenModifier[SemanticHighlightModifier.Static] = 2 ** DefaultTokenModifier.static;
