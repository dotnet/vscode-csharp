/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

const parser = require('jsonc-parser');

import {
    CancellationToken,
    CompletionItem,
    CompletionItemProvider,
    CompletionList,
    Disposable,
    DocumentSelector,
    Hover,
    HoverProvider,
    MarkedString,
    Position,
    Range,
    TextDocument,
    TextEdit,
    languages,
    workspace
} from 'vscode';
import { configure as configureXHR, xhr } from 'request-light';

import { ProjectJSONContribution } from './projectJSONContribution';

export interface ISuggestionsCollector {
    add(suggestion: CompletionItem): void;
    error(message: string): void;
    log(message: string): void;
    setAsIncomplete(): void;
}

export interface IJSONContribution {
    getDocumentSelector(): DocumentSelector;
    getInfoContribution(fileName: string, location: any): Thenable<MarkedString[]>;
    collectPropertySuggestions(fileName: string, location: any, currentWord: string, addValue: boolean, isLast: boolean, result: ISuggestionsCollector): Thenable<any>;
    collectValueSuggestions(fileName: string, location: any, result: ISuggestionsCollector): Thenable<any>;
    collectDefaultSuggestions(fileName: string, result: ISuggestionsCollector): Thenable<any>;
    resolveSuggestion?(item: CompletionItem): Thenable<CompletionItem>;
}

export function addJSONProviders(): Disposable {
    let subscriptions: Disposable[] = [];

    // configure the XHR library with the latest proxy settings
    function configureHttpRequest() {
        let httpSettings = workspace.getConfiguration('http');
        configureXHR(httpSettings.get<string>('proxy'), httpSettings.get<boolean>('proxyStrictSSL'));
    }

    configureHttpRequest();
    subscriptions.push(workspace.onDidChangeConfiguration(e => configureHttpRequest()));

    // register completion and hove providers for JSON setting file(s)
    let contributions = [new ProjectJSONContribution(xhr)];
    contributions.forEach(contribution => {
        let selector = contribution.getDocumentSelector();
        let triggerCharacters = ['"', ':', '.', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        subscriptions.push(languages.registerCompletionItemProvider(selector, new JSONCompletionItemProvider(contribution), ...triggerCharacters));
        subscriptions.push(languages.registerHoverProvider(selector, new JSONHoverProvider(contribution)));
    });

    return Disposable.from(...subscriptions);
}

export class JSONHoverProvider implements HoverProvider {

    constructor(private jsonContribution: IJSONContribution) {
    }

    public provideHover(document: TextDocument, position: Position, token: CancellationToken): Thenable<Hover> {
        let offset = document.offsetAt(position);
        let location = parser.getLocation(document.getText(), offset);
        let node = location.previousNode;
        if (node && node.offset <= offset && offset <= node.offset + node.length) {
            let promise = this.jsonContribution.getInfoContribution(document.fileName, location);
            if (promise) {
                return promise.then(htmlContent => {
                    let range = new Range(document.positionAt(node.offset), document.positionAt(node.offset + node.length));
                    let result: Hover = {
                        contents: htmlContent,
                        range: range
                    };
                    return result;
                });
            }
        }
        return null;
    }
}

export class JSONCompletionItemProvider implements CompletionItemProvider {

    constructor(private jsonContribution: IJSONContribution) {
    }

    public resolveCompletionItem(item: CompletionItem, token: CancellationToken): Thenable<CompletionItem> {
        if (this.jsonContribution.resolveSuggestion) {
            let resolver = this.jsonContribution.resolveSuggestion(item);
            if (resolver) {
                return resolver;
            }
        }
        return Promise.resolve(item);
    }

    public provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): Thenable<CompletionList> {
        let currentWord = this.getCurrentWord(document, position);
        let overwriteRange = null;
        let items: CompletionItem[] = [];
        let isIncomplete = false;

        let offset = document.offsetAt(position);
        let location = parser.getLocation(document.getText(), offset);

        let node = location.previousNode;
        if (node && node.offset <= offset && offset <= node.offset + node.length && (node.type === 'property' || node.type === 'string' || node.type === 'number' || node.type === 'boolean' || node.type === 'null')) {
            overwriteRange = new Range(document.positionAt(node.offset), document.positionAt(node.offset + node.length));
        } else {
            overwriteRange = new Range(document.positionAt(offset - currentWord.length), position);
        }

        let proposed: { [key: string]: boolean } = {};
        let collector: ISuggestionsCollector = {
            add: (suggestion: CompletionItem) => {
                if (!proposed[suggestion.label]) {
                    proposed[suggestion.label] = true;
                    if (overwriteRange) {
                        suggestion.textEdit = TextEdit.replace(overwriteRange, <string>suggestion.insertText);
                    }

                    items.push(suggestion);
                }
            },
            setAsIncomplete: () => isIncomplete = true,
            error: (message: string) => console.error(message),
            log: (message: string) => console.log(message)
        };

        let collectPromise: Thenable<any> = null;

        if (location.isAtPropertyKey) {
            let addValue = !location.previousNode || !location.previousNode.columnOffset && (offset == (location.previousNode.offset + location.previousNode.length));
            let scanner = parser.createScanner(document.getText(), true);
            scanner.setPosition(offset);
            scanner.scan();
            let isLast = scanner.getToken() === parser.SyntaxKind.CloseBraceToken || scanner.getToken() === parser.SyntaxKind.EOF;
            collectPromise = this.jsonContribution.collectPropertySuggestions(document.fileName, location, currentWord, addValue, isLast, collector);
        } else {
            if (location.path.length === 0) {
                collectPromise = this.jsonContribution.collectDefaultSuggestions(document.fileName, collector);
            } else {
                collectPromise = this.jsonContribution.collectValueSuggestions(document.fileName, location, collector);
            }
        }
        if (collectPromise) {
            return collectPromise.then(() => {
                if (items.length > 0) {
                    return new CompletionList(items, isIncomplete);
                }
                return null;
            });
        }
        return null;
    }

    private getCurrentWord(document: TextDocument, position: Position) {
        let i = position.character - 1;
        let text = document.lineAt(position.line).text;
        while (i >= 0 && ' \t\n\r\v":{[,'.indexOf(text.charAt(i)) === -1) {
            i--;
        }
        return text.substring(i + 1, position.character);
    }
}