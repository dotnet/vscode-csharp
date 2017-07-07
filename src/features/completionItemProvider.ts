/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { extractSummaryText } from './documentation';
import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { createRequest } from '../omnisharp/typeConvertion';
import { CompletionItemProvider, CompletionItem, CompletionItemKind, CancellationToken, TextDocument, Range, Position, SnippetString } from 'vscode';
import { Delimiter } from "./utils";

export default class OmniSharpCompletionItemProvider extends AbstractSupport implements CompletionItemProvider {

    // copied from Roslyn here: https://github.com/dotnet/roslyn/blob/6e8f6d600b6c4bc0b92bc3d782a9e0b07e1c9f8e/src/Features/Core/Portable/Completion/CompletionRules.cs#L166-L169
    private static AllCommitCharacters = [
        ' ', '{', '}', '[', ']', '(', ')', '.', ',', ':',
        ';', '+', '-', '*', '/', '%', '&', '|', '^', '!',
        '~', '=', '<', '>', '?', '@', '#', '\'', '\"', '\\'];

    private static CommitCharactersWithoutSpace = [
        '{', '}', '[', ']', '(', ')', '.', ',', ':',
        ';', '+', '-', '*', '/', '%', '&', '|', '^', '!',
        '~', '=', '<', '>', '?', '@', '#', '\'', '\"', '\\'];

    public provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): Promise<CompletionItem[]> {

        let wordToComplete = '';
        let range = document.getWordRangeAtPosition(position);
        if (range) {
            wordToComplete = document.getText(new Range(range.start, position));
        }

        let req = createRequest<protocol.AutoCompleteRequest>(document, position);
        req.WordToComplete = wordToComplete;
        req.WantDocumentationForEveryCompletionResult = true;
        req.WantKind = true;
        req.WantReturnType = true;
        req.WantSnippet = true;

        return serverUtils.autoComplete(this._server, req).then(responses => {

            if (!responses) {
                return;
            }

            let result: CompletionItem[] = [];
            let completionGroups: { [label: string]: CompletionGroup } = Object.create(null);

            for (let response of responses) {
                let completionText = OmniSharpCompletionItemProvider.getCompletionText(response);
                let group = completionGroups[completionText.label];
                if (!group) {
                    let completion = new CompletionItem(completionText.label);

                    completion.detail = response.ReturnType
                        ? `${response.ReturnType} ${response.DisplayText}`
                        : response.DisplayText;

                    completion.documentation = extractSummaryText(response.Description);
                    completion.kind = _kinds[response.Kind] || CompletionItemKind.Property;
                    completion.insertText = completionText.insertText;

                    completion.commitCharacters = response.IsSuggestionMode
                        ? OmniSharpCompletionItemProvider.CommitCharactersWithoutSpace
                        : OmniSharpCompletionItemProvider.AllCommitCharacters;

                    group = { represent: completion, overloadCount: 0, maxTabStopCount: completionText.tabStopCount };
                    completionGroups[completionText.label] = group;
                } else {
                    group.overloadCount++;

                    // Provide any valid documentation, if present.                    
                    if (group.represent.documentation == null || group.represent.documentation.length == 0) {
                        let documentation = extractSummaryText(response.Description);
                        if (documentation != null && documentation.length > 0) {
                            group.represent.documentation = documentation;
                        }
                    }

                    if (group.maxTabStopCount < completionText.tabStopCount) {
                        group.maxTabStopCount = completionText.tabStopCount;
                        group.represent.insertText = completionText.insertText;
                    }
                }
            }

            for (let key in completionGroups) {
                let suggestion = completionGroups[key].represent;
                let overloadCount = completionGroups[key].overloadCount;
                if (overloadCount > 0) {
                    suggestion.detail = `${suggestion.detail} (+ ${overloadCount} overload(s))`;
                }
                result.push(suggestion);
            }

            return result;
        });
    }

    private static getCompletionText(response: protocol.AutoCompleteResponse): CompletionText {
        if (response.Kind == 'Keyword') {
            return OmniSharpCompletionItemProvider.getKeywordCompletionText(response.CompletionText);
        }

        // CompletionText contains parameters only when         
        if (response.CompletionText.indexOf(_paramsDelimiter.start) >= 0) {
            console.log(response.CompletionText);
            return OmniSharpCompletionItemProvider.getOverridingMethodCompletionText(response.CompletionText, response.ReturnType);
        }

        let completionText = <CompletionText>{ tabStopCount: 0 };
        let hasParams = false;
        let hasTypeParams = false;

        let label = response.DisplayText;
        label = _paramsDelimiter.replace(label, found => {
            if (found.length > 0) {
                hasParams = true;
            }
            return '';
        });

        label = _typeParamsDelimiter.replace(label, found => {
            hasTypeParams = true;
            return '';
        });

        completionText.label = label;

        let text = response.DisplayText;
        let getTabStop = () => { return '$' + ++completionText.tabStopCount; };
        if (hasTypeParams) {
            text = _typeParamsDelimiter.replace(text, found => { return getTabStop(); });
        }
        if (hasParams) {
            text = _paramsDelimiter.replace(text, found => { return getTabStop(); });
        }

        if (response.Kind == 'Method' && response.ReturnType == 'void') {
            text += ';';
        }
        text += '$0';
        completionText.insertText = new SnippetString(text);
        return completionText;
    }

    private static getKeywordCompletionText(keyword: string): CompletionText {
        let completionText = <CompletionText>{ label: keyword };

        if (keyword in _trailingSpaceKeywords) {
            completionText.insertText = keyword + ' ';
            completionText.tabStopCount = 0;
        } else if (keyword in _paramKeywords) {
            completionText.insertText = new SnippetString(keyword + '($1)$0');
            completionText.tabStopCount = 1;
        } else {
            completionText.insertText = keyword;
            completionText.tabStopCount = 0;
        }

        return completionText;
    }

    private static getOverridingMethodCompletionText(text: string, returnType: string): CompletionText {
        let baseCode = 'base.' + text + ';$0';
        baseCode = _paramsDelimiter.replace(baseCode, found => {
            let params = found.split(',');
            for (let i = 0; i < params.length; i++) {
                let paramBlock = params[i];
                let paramSplit = paramBlock.split(/\s+/);
                let paramName = paramSplit[paramSplit.length - 1];
                params[i] = paramName;
            }

            return params.join(', ');
        });

        if (returnType != 'void') {
            baseCode = 'return ' + baseCode;
        }

        return {
            label: text,
            insertText: new SnippetString(returnType + ' ' + text + '\n{\n\t' + baseCode + '\n}'),
            tabStopCount: 0
        };
    }
}

interface CompletionText {
    label: string;
    insertText: string | SnippetString;
    tabStopCount: number;
}

interface CompletionGroup {
    represent: CompletionItem;
    overloadCount: number;
    maxTabStopCount: number;
}

const _typeParamsDelimiter = new Delimiter('<', '>');
const _paramsDelimiter = new Delimiter('(', ')');

const _trailingSpaceKeywords: { [keyword: string]: boolean } = Object.create(null);
_trailingSpaceKeywords['abstract'] = true;
_trailingSpaceKeywords['as'] = true;
_trailingSpaceKeywords['async'] = true;
_trailingSpaceKeywords['await'] = true;
_trailingSpaceKeywords['const'] = true;
_trailingSpaceKeywords['dynamic'] = true;
_trailingSpaceKeywords['explicit'] = true;
_trailingSpaceKeywords['extern'] = true;
_trailingSpaceKeywords['goto'] = true;
_trailingSpaceKeywords['implicit'] = true;
_trailingSpaceKeywords['in'] = true;
_trailingSpaceKeywords['internal'] = true;
_trailingSpaceKeywords['is'] = true;
_trailingSpaceKeywords['out'] = true;
_trailingSpaceKeywords['override'] = true;
_trailingSpaceKeywords['params'] = true;
_trailingSpaceKeywords['private'] = true;
_trailingSpaceKeywords['protected'] = true;
_trailingSpaceKeywords['public'] = true;
_trailingSpaceKeywords['readonly'] = true;
_trailingSpaceKeywords['ref'] = true;
_trailingSpaceKeywords['sealed'] = true;
_trailingSpaceKeywords['stackalloc'] = true;
_trailingSpaceKeywords['static'] = true;
_trailingSpaceKeywords['unsafe'] = true;
_trailingSpaceKeywords['using'] = true;
_trailingSpaceKeywords['var'] = true;
_trailingSpaceKeywords['virtual'] = true;
_trailingSpaceKeywords['volatile'] = true;
_trailingSpaceKeywords['yield'] = true;

const _paramKeywords: { [keyword: string]: boolean } = Object.create(null);
_paramKeywords['nameof'] = true;
_paramKeywords['typeof'] = true;
_paramKeywords['sizeof'] = true;

const _kinds: { [kind: string]: CompletionItemKind; } = Object.create(null);

// types
_kinds['Class'] = CompletionItemKind.Class;
_kinds['Delegate'] = CompletionItemKind.Class; // need a better option for this.
_kinds['Enum'] = CompletionItemKind.Enum;
_kinds['Interface'] = CompletionItemKind.Interface;
_kinds['Struct'] = CompletionItemKind.Struct;

// variables
_kinds['Local'] = CompletionItemKind.Variable;
_kinds['Parameter'] = CompletionItemKind.Variable;
_kinds['RangeVariable'] = CompletionItemKind.Variable;

// members
_kinds['Const'] = CompletionItemKind.Constant;
_kinds['EnumMember'] = CompletionItemKind.EnumMember;
_kinds['Event'] = CompletionItemKind.Event;
_kinds['Field'] = CompletionItemKind.Field;
_kinds['Method'] = CompletionItemKind.Method;
_kinds['Property'] = CompletionItemKind.Property;

// other stuff
_kinds['Label'] = CompletionItemKind.Unit; // need a better option for this.
_kinds['Keyword'] = CompletionItemKind.Keyword;
_kinds['Namespace'] = CompletionItemKind.Module;
