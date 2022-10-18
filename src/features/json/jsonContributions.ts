/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Location, getLocation, createScanner, SyntaxKind } from 'jsonc-parser';
import { ProjectJSONContribution } from './projectJSONContribution';
import { configure as configureXHR, xhr } from 'request-light';

import {
    CompletionItem, CompletionItemProvider, CompletionList, TextDocument, Position, Hover, HoverProvider,
    CancellationToken, Range, MarkedString, DocumentSelector, languages, workspace
} from 'vscode';
import CompositeDisposable from '../../CompositeDisposable';

export interface ISuggestionsCollector {
    add(suggestion: CompletionItem): void;
    error(message: string): void;
    log(message: string): void;
    setAsIncomplete(): void;
}

export interface IJSONContribution {
    getDocumentSelector(): DocumentSelector;
    getInfoContribution(fileName: string, location: Location): Promise<MarkedString[] | undefined>;
    collectPropertySuggestions(fileName: string, location: Location, currentWord: string, addValue: boolean, isLast: boolean, result: ISuggestionsCollector): Promise<void>;
    collectValueSuggestions(fileName: string, location: Location, result: ISuggestionsCollector): Promise<void>;
    collectDefaultSuggestions(fileName: string, result: ISuggestionsCollector): Promise<void>;
    resolveSuggestion?(item: CompletionItem): Promise<CompletionItem | undefined>;
}

export function addJSONProviders(): CompositeDisposable {
    let subscriptions = new CompositeDisposable();

    // configure the XHR library with the latest proxy settings
    function configureHttpRequest() {
        let httpSettings = workspace.getConfiguration('http');
        configureXHR(httpSettings.get<string>('proxy', ''), httpSettings.get<boolean>('proxyStrictSSL', false));
    }

    configureHttpRequest();
    subscriptions.add(workspace.onDidChangeConfiguration(e => configureHttpRequest()));

    // register completion and hove providers for JSON setting file(s)
    let contributions = [new ProjectJSONContribution(xhr)];
    contributions.forEach(contribution => {
        let selector = contribution.getDocumentSelector();
        let triggerCharacters = ['"', ':', '.', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        subscriptions.add(languages.registerCompletionItemProvider(selector, new JSONCompletionItemProvider(contribution), ...triggerCharacters));
        subscriptions.add(languages.registerHoverProvider(selector, new JSONHoverProvider(contribution)));
    });

    return subscriptions;
}

export class JSONHoverProvider implements HoverProvider {

    constructor(private jsonContribution: IJSONContribution) {
    }

    public async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover | undefined> {
        let offset = document.offsetAt(position);
        let location = getLocation(document.getText(), offset);
        let node = location.previousNode;
        if (node !== undefined && node.offset <= offset && offset <= node.offset + node.length) {
            let htmlContent = await this.jsonContribution.getInfoContribution(document.fileName, location);
            if (htmlContent !== undefined) {
                let range = new Range(document.positionAt(node.offset), document.positionAt(node.offset + node.length));
                let result: Hover = {
                    contents: htmlContent,
                    range: range
                };
                return result;
            }
        }
        return undefined;
    }
}

export class JSONCompletionItemProvider implements CompletionItemProvider {

    constructor(private jsonContribution: IJSONContribution) {
    }

    public async resolveCompletionItem(item: CompletionItem, token: CancellationToken): Promise<CompletionItem> {
        if (this.jsonContribution.resolveSuggestion) {
            let resolver = await this.jsonContribution.resolveSuggestion(item);
            if (resolver !== undefined) {
                return resolver;
            }
        }
        return item;
    }

    public async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): Promise<CompletionList | undefined> {
        let currentWord = this.getCurrentWord(document, position);
        let overwriteRange: Range | undefined;
        let items: CompletionItem[] = [];
        let isIncomplete = false;

        let offset = document.offsetAt(position);
        let location = getLocation(document.getText(), offset);

        let node = location.previousNode;
        if (node && node.offset <= offset && offset <= node.offset + node.length && (node.type === 'property' || node.type === 'string' || node.type === 'number' || node.type === 'boolean' || node.type === 'null')) {
            overwriteRange = new Range(document.positionAt(node.offset), document.positionAt(node.offset + node.length));
        } else {
            overwriteRange = new Range(document.positionAt(offset - currentWord.length), position);
        }

        let proposed: { [key: string]: boolean } = {};
        let collector: ISuggestionsCollector = {
            add: (suggestion: CompletionItem) => {
                if (!proposed[<string>suggestion.label]) {
                    proposed[<string>suggestion.label] = true;
                    if (overwriteRange !== undefined) {
                        suggestion.insertText = suggestion.insertText;
                        suggestion.range = overwriteRange;
                    }

                    items.push(suggestion);
                }
            },
            setAsIncomplete: () => isIncomplete = true,
            error: (message: string) => console.error(message),
            log: (message: string) => console.log(message)
        };

        let collectPromise: Promise<void> | undefined;

        if (location.isAtPropertyKey) {
            let addValue = !location.previousNode || !location.previousNode.colonOffset && (offset == (location.previousNode.offset + location.previousNode.length));
            let scanner = createScanner(document.getText(), true);
            scanner.setPosition(offset);
            scanner.scan();
            let isLast = scanner.getToken() === SyntaxKind.CloseBraceToken || scanner.getToken() === SyntaxKind.EOF;
            collectPromise = this.jsonContribution.collectPropertySuggestions(document.fileName, location, currentWord, addValue, isLast, collector);
        } else {
            if (location.path.length === 0) {
                collectPromise = this.jsonContribution.collectDefaultSuggestions(document.fileName, collector);
            } else {
                collectPromise = this.jsonContribution.collectValueSuggestions(document.fileName, location, collector);
            }
        }

        await collectPromise;
        if (items.length > 0) {
            return new CompletionList(items, isIncomplete);
        }
        return undefined;
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
