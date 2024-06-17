/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import {
    CompletionItem,
    CompletionList,
    CompletionParams,
    CompletionTriggerKind,
    InsertReplaceEdit,
    InsertTextMode,
    Position,
    RequestType,
    TextEdit,
} from 'vscode-languageclient';
import { provideCompletionsCommand, resolveCompletionsCommand } from '../../../lsptoolshost/razorCommands';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { RazorDocumentSynchronizer } from '../document/razorDocumentSynchronizer';
import { RazorLanguageServerClient } from '../razorLanguageServerClient';
import { RazorLogger } from '../razorLogger';
import { SerializableDelegatedCompletionParams } from './serializableDelegatedCompletionParams';
import { SerializableDelegatedCompletionItemResolveParams } from './serializableDelegatedCompletionItemResolveParams';
import { LanguageKind } from '../rpc/languageKind';
import { UriConverter } from '../../../lsptoolshost/uriConverter';
import { MarkupContent, Range } from 'vscode-html-languageservice';

export class CompletionHandler {
    private static readonly completionEndpoint = 'razor/completion';
    private static readonly completionResolveEndpoint = 'razor/completionItem/resolve';
    private completionRequestType: RequestType<SerializableDelegatedCompletionParams, CompletionList, any> =
        new RequestType(CompletionHandler.completionEndpoint);
    private completionResolveRequestType: RequestType<
        SerializableDelegatedCompletionItemResolveParams,
        CompletionItem,
        any
    > = new RequestType(CompletionHandler.completionResolveEndpoint);
    // TODO: do we always need empty result members defined? Can we declare type on handler function and return null?
    // Also, none of the empty repsonses are declared as static readonly in other handles - should they be?
    private static readonly emptyCompletionList: CompletionList = <CompletionList>{};
    private static readonly emptyCompletionItem: CompletionItem = <CompletionItem>{};

    constructor(
        private readonly documentManager: RazorDocumentManager,
        private readonly documentSynchronizer: RazorDocumentSynchronizer,
        private readonly serverClient: RazorLanguageServerClient,
        private readonly logger: RazorLogger
    ) {}

    public async register() {
        await this.serverClient.onRequestWithParams<SerializableDelegatedCompletionParams, CompletionList, any>(
            this.completionRequestType,
            async (request: SerializableDelegatedCompletionParams, token: vscode.CancellationToken) =>
                this.provideCompletions(request, token)
        );

        await this.serverClient.onRequestWithParams<
            SerializableDelegatedCompletionItemResolveParams,
            CompletionItem,
            any
        >(
            this.completionResolveRequestType,
            async (request: SerializableDelegatedCompletionItemResolveParams, token: vscode.CancellationToken) =>
                this.provideResolvedCompletionItem(request, token)
        );
    }

    private async provideCompletions(
        delegatedCompletionParams: SerializableDelegatedCompletionParams,
        token: vscode.CancellationToken
    ) {
        try {
            const razorDocumentUri = vscode.Uri.parse(
                delegatedCompletionParams.identifier.textDocumentIdentifier.uri,
                true
            );
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                return CompletionHandler.emptyCompletionList;
            }

            const textDocument = await vscode.workspace.openTextDocument(razorDocumentUri);

            let virtualDocument: any;
            if (delegatedCompletionParams.projectedKind === LanguageKind.Html) {
                virtualDocument = razorDocument.htmlDocument;
            } else if (delegatedCompletionParams.projectedKind === LanguageKind.CSharp) {
                virtualDocument = razorDocument.csharpDocument;
            } else {
                // TODO: equivalent of Debug.Fail?
                return CompletionHandler.emptyCompletionList;
            }

            // TODO: Should we check for null or undefined virtual document like we do in C# code?

            const synchronized = await this.documentSynchronizer.trySynchronizeProjectedDocument(
                textDocument,
                virtualDocument,
                delegatedCompletionParams.identifier.version,
                token
            );
            if (!synchronized) {
                return CompletionHandler.emptyCompletionList;
            }

            const virtualDocumentUri = UriConverter.serialize(virtualDocument.uri);

            delegatedCompletionParams.identifier.textDocumentIdentifier.uri = virtualDocumentUri;

            // TODO: support for provisional edits

            // "@" is not a valid trigger character for C# / HTML and therefore we need to translate
            // it into a non-trigger invocation.
            const modifiedTriggerCharacter =
                delegatedCompletionParams.context.triggerCharacter === '@'
                    ? undefined
                    : delegatedCompletionParams.context.triggerCharacter;
            const triggerKind =
                delegatedCompletionParams.context.triggerCharacter === '@'
                    ? CompletionTriggerKind.Invoked
                    : delegatedCompletionParams.context.triggerKind;

            // Roslyn/C# completion
            if (delegatedCompletionParams.projectedKind === LanguageKind.CSharp) {
                const params: CompletionParams = {
                    context: {
                        triggerKind: triggerKind,
                        triggerCharacter: modifiedTriggerCharacter,
                    },
                    textDocument: {
                        uri: virtualDocumentUri,
                    },
                    position: delegatedCompletionParams.projectedPosition,
                };

                const roslynCompletions = await vscode.commands.executeCommand<CompletionList>(
                    provideCompletionsCommand,
                    params
                );
                CompletionHandler.AdjustRoslynCompletionList(
                    roslynCompletions,
                    delegatedCompletionParams.context.triggerCharacter
                );
                return roslynCompletions;
            }

            // HTML completion
            const completions = await vscode.commands.executeCommand<vscode.CompletionList | vscode.CompletionItem[]>(
                'vscode.executeCompletionItemProvider',
                UriConverter.deserialize(virtualDocumentUri),
                delegatedCompletionParams.projectedPosition,
                modifiedTriggerCharacter
            );

            const completionItems =
                completions instanceof Array
                    ? completions // was vscode.CompletionItem[]
                    : completions
                    ? completions.items // was vscode.CompletionList
                    : [];

            const convertedCompletionItems: CompletionItem[] = new Array(completionItems.length);
            for (let i = 0; i < completionItems.length; i++) {
                const completionItem = completionItems[i];
                const convertedCompletionItem = <CompletionItem>{
                    command: completionItem.command, // no conversion needed as fields match
                    commitCharacters: completionItem.commitCharacters,
                    detail: completionItem.detail,
                    documentation: CompletionHandler.ToMarkupContent(completionItem.documentation),
                    filterText: completionItem.filterText,
                    insertText: CompletionHandler.ToLspInsertText(completionItem.insertText),
                    insertTextMode: CompletionHandler.ToInsertTextMode(completionItem.keepWhitespace),
                    kind: completionItem.kind,
                    label: CompletionHandler.ToLspCompletionItemLabel(completionItem.label),
                    preselect: completionItem.preselect,
                    sortText: completionItem.sortText,
                    textEdit: CompletionHandler.ToLspTextEdit(
                        CompletionHandler.ToLspInsertText(completionItem.insertText),
                        completionItem.range
                    ),
                };
                convertedCompletionItems[i] = convertedCompletionItem;
            }

            const isIncomplete = completions instanceof Array ? false : completions ? completions.isIncomplete : false;
            const completionList = <CompletionList>{
                isIncomplete: isIncomplete,
                items: convertedCompletionItems,
            };

            return completionList;
        } catch (error) {
            this.logger.logWarning(`${CompletionHandler.completionEndpoint} failed with ${error}`);
        }

        return CompletionHandler.emptyCompletionList;
    }

    private async provideResolvedCompletionItem(
        delegatedCompletionItemResolveParams: SerializableDelegatedCompletionItemResolveParams,
        _cancellationToken: vscode.CancellationToken
    ) {
        // TODO: Snippet support

        if (delegatedCompletionItemResolveParams.originatingKind != LanguageKind.CSharp) {
            return delegatedCompletionItemResolveParams.completionItem;
        } else {
            const newItem = await vscode.commands.executeCommand<CompletionItem>(
                resolveCompletionsCommand,
                delegatedCompletionItemResolveParams.completionItem
            );

            if (!newItem) {
                return delegatedCompletionItemResolveParams.completionItem;
            }

            return newItem;
        }

        return CompletionHandler.emptyCompletionItem;
    }

    private static AdjustRoslynCompletionList(completionList: CompletionList, triggerCharacter: string | undefined) {
        const data = completionList.itemDefaults?.data;
        for (const completionItem of completionList.items) {
            // textEdit is deprecated in favor of .range. Clear out its value to avoid any unexpected behavior.
            completionItem.textEdit = undefined;

            if (triggerCharacter === '@' && completionItem.commitCharacters) {
                // We remove `{`, '(', and '*' from the commit characters to prevent auto-completing the first
                // completion item with a curly brace when a user intended to type `@{}` or `@()`.
                completionItem.commitCharacters = completionItem.commitCharacters.filter(
                    (commitChar) => commitChar !== '{' && commitChar !== '(' && commitChar !== '*'
                );
            }

            // for intellicode items, manually set the insertText to avoid including stars in the commit
            if (completionItem.label.toString().includes('\u2605')) {
                if (completionItem.textEditText) {
                    completionItem.insertText = completionItem.textEditText;
                }
            }

            if (!completionItem.data) {
                completionItem.data = data;
            }
        }
    }

    // converts completion item documentation from vscode format to LSP format
    private static ToMarkupContent(documentation?: string | vscode.MarkdownString): string | MarkupContent | undefined {
        const markdownString = documentation as vscode.MarkdownString;
        if (!markdownString?.value) {
            return <string | undefined>documentation;
        }
        const markupContent: MarkupContent = {
            value: markdownString.value,
            kind: 'markdown',
        };

        return markupContent;
    }

    private static ToLspCompletionItemLabel(label: string | vscode.CompletionItemLabel): string {
        const completionItemLabel = label as vscode.CompletionItemLabel;
        return completionItemLabel?.label ?? <string>label;
    }

    private static ToLspInsertText(insertText?: string | vscode.SnippetString): string | undefined {
        const snippetString = insertText as vscode.SnippetString;
        return snippetString?.value ?? <string | undefined>insertText;
    }

    private static ToLspTextEdit(
        newText?: string,
        range?: vscode.Range | { inserting: vscode.Range; replacing: vscode.Range }
    ): TextEdit | InsertReplaceEdit | undefined {
        if (!range) {
            return undefined;
        }
        if (!newText) {
            newText = '';
        }
        const insertingRange = (range as any).inserting;
        if (insertingRange) {
            // do something
        }
        const replacingRange = (range as any).replacing;
        if (replacingRange) {
            // Do something else
        }

        if (!(insertingRange || replacingRange)) {
            const textEdit: TextEdit = {
                newText: newText,
                range: this.ToLspRange(<vscode.Range>range),
            };

            return textEdit;
        }

        if (!insertingRange || !replacingRange) {
            // We need both inserting and replacing ranges to convert to InsertReplaceEdit
            return undefined;
        }
        const insertReplaceEdit: InsertReplaceEdit = {
            newText: newText,
            insert: CompletionHandler.ToLspRange(insertingRange),
            replace: CompletionHandler.ToLspRange(replacingRange),
        };

        return insertReplaceEdit;
    }

    private static ToLspRange(range: vscode.Range): Range {
        const lspRange: Range = {
            start: CompletionHandler.ToLspPosition(range.start),
            end: CompletionHandler.ToLspPosition(range.end),
        };

        return lspRange;
    }

    private static ToLspPosition(position: vscode.Position): Position {
        const lspPosition: Position = {
            line: position.line,
            character: position.character,
        };

        return lspPosition;
    }

    private static ToInsertTextMode(keepWhitespace?: boolean): InsertTextMode | undefined {
        if (keepWhitespace === undefined) {
            return undefined;
        }

        const insertTextMode: InsertTextMode = keepWhitespace ? InsertTextMode.asIs : InsertTextMode.adjustIndentation;
        return insertTextMode;
    }
}
