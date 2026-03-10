/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
    CompletionItem,
    CompletionList,
    InsertReplaceEdit,
    InsertTextFormat,
    InsertTextMode,
    MarkupContent,
    Position,
    Range,
    TextEdit,
} from 'vscode-languageserver-protocol';

export class CompletionHandler {
    constructor() {}

    // Provide completions using standard vscode executeCompletionItemProvider command
    // Used in HTML context
    public static async provideVscodeCompletions(
        virtualDocumentUri: vscode.Uri,
        projectedPosition: Position,
        triggerCharacter: string | undefined
    ) {
        const completions = await vscode.commands.executeCommand<vscode.CompletionList | vscode.CompletionItem[]>(
            'vscode.executeCompletionItemProvider',
            virtualDocumentUri,
            projectedPosition,
            triggerCharacter
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
                documentation: CompletionHandler.toMarkupContent(completionItem.documentation),
                filterText: completionItem.filterText,
                insertText: CompletionHandler.toLspInsertText(completionItem.insertText),
                insertTextFormat: CompletionHandler.toLspInsertTextFormat(completionItem.insertText),
                insertTextMode: CompletionHandler.toInsertTextMode(completionItem.keepWhitespace),
                kind: completionItem.kind ? completionItem.kind + 1 : completionItem.kind, // VSCode and LSP are off by one
                label: CompletionHandler.toLspCompletionItemLabel(completionItem.label),
                preselect: completionItem.preselect,
                sortText: completionItem.sortText,
                textEdit: CompletionHandler.toLspTextEdit(
                    CompletionHandler.toLspInsertText(completionItem.insertText),
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
    }

    // converts completion item documentation from vscode format to LSP format
    private static toMarkupContent(documentation?: string | vscode.MarkdownString): string | MarkupContent | undefined {
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

    private static toLspCompletionItemLabel(label: string | vscode.CompletionItemLabel): string {
        const completionItemLabel = label as vscode.CompletionItemLabel;
        return completionItemLabel?.label ?? <string>label;
    }

    private static toLspInsertText(insertText?: string | vscode.SnippetString): string | undefined {
        const snippetString = insertText as vscode.SnippetString;
        return snippetString?.value ?? <string | undefined>insertText;
    }

    private static toLspInsertTextFormat(insertText?: string | vscode.SnippetString): InsertTextFormat {
        return insertText instanceof vscode.SnippetString ? InsertTextFormat.Snippet : InsertTextFormat.PlainText;
    }

    private static toInsertTextMode(keepWhitespace?: boolean): InsertTextMode | undefined {
        if (keepWhitespace === undefined) {
            return undefined;
        }

        const insertTextMode: InsertTextMode = keepWhitespace ? InsertTextMode.asIs : InsertTextMode.adjustIndentation;
        return insertTextMode;
    }

    private static toLspTextEdit(
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
                range: this.toLspRange(<vscode.Range>range),
            };

            return textEdit;
        }

        if (!insertingRange || !replacingRange) {
            // We need both inserting and replacing ranges to convert to InsertReplaceEdit
            return undefined;
        }
        const insertReplaceEdit: InsertReplaceEdit = {
            newText: newText,
            insert: CompletionHandler.toLspRange(insertingRange),
            replace: CompletionHandler.toLspRange(replacingRange),
        };

        return insertReplaceEdit;
    }

    private static toLspRange(range: vscode.Range): Range {
        const lspRange: Range = {
            start: CompletionHandler.toLspPosition(range.start),
            end: CompletionHandler.toLspPosition(range.end),
        };

        return lspRange;
    }

    private static toLspPosition(position: vscode.Position): Position {
        const lspPosition: Position = {
            line: position.line,
            character: position.character,
        };

        return lspPosition;
    }
}
