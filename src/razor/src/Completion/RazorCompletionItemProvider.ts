/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { RazorDocumentManager } from '../Document/RazorDocumentManager';
import { RazorDocumentSynchronizer } from '../Document/RazorDocumentSynchronizer';
import { RazorLanguageFeatureBase } from '../RazorLanguageFeatureBase';
import { RazorLanguageServiceClient } from '../RazorLanguageServiceClient';
import { RazorLogger } from '../RazorLogger';
import { getUriPath } from '../UriPaths';
import { ProvisionalCompletionOrchestrator } from './ProvisionalCompletionOrchestrator';
import { LanguageKind } from '../RPC/LanguageKind';
import { RoslynLanguageServer } from '../../../lsptoolshost/roslynLanguageServer';
import { CompletionItem, CompletionList, CompletionParams, CompletionTriggerKind } from 'vscode-languageclient';
import { UriConverter } from '../../../lsptoolshost/uriConverter';
import * as RazorConventions from '../RazorConventions';
import { MappingHelpers } from '../Mapping/MappingHelpers';

export class RazorCompletionItemProvider
    extends RazorLanguageFeatureBase
    implements vscode.CompletionItemProvider {

    public static async getCompletions(
        projectedUri: vscode.Uri, hostDocumentPosition: vscode.Position,
        projectedPosition: vscode.Position, context: vscode.CompletionContext,
        language: LanguageKind) {

        if (projectedUri) {
            // "@" is not a valid trigger character for C# / HTML and therefore we need to translate
            // it into a non-trigger invocation.
            const modifiedTriggerCharacter = context.triggerCharacter === '@' ? undefined : context.triggerCharacter;
            const triggerKind = context.triggerCharacter === '@' ? CompletionTriggerKind.Invoked : getTriggerKind(context.triggerKind);

            let completions: vscode.CompletionList | vscode.CompletionItem[];

            if (language === LanguageKind.CSharp) {
                const params: CompletionParams = {
                    context: {
                        triggerKind: triggerKind,
                        triggerCharacter: modifiedTriggerCharacter
                    },
                    textDocument: {
                        uri: UriConverter.serialize(projectedUri),
                    },
                    position: projectedPosition
                };

                // For CSharp, completions need to keep the "data" field on the
                // completion item for lazily resolving the edits in the
                // resolveCompletionItem step. Using the vs code command drops
                // that field because it doesn't exist in the declared vs code
                // CompletionItem type.
                completions = await vscode
                    .commands
                    .executeCommand<vscode.CompletionList | vscode.CompletionItem[]>(
                        RoslynLanguageServer.provideCompletionsCommand,
                        params);
            } else {
                completions = await vscode
                    .commands
                    .executeCommand<vscode.CompletionList | vscode.CompletionItem[]>(
                        'vscode.executeCompletionItemProvider',
                        projectedUri,
                        projectedPosition,
                        modifiedTriggerCharacter);
            }

            const completionItems =
                completions instanceof Array ? completions  // was vscode.CompletionItem[]
                    : completions ? completions.items       // was vscode.CompletionList
                        : [];
            
            const data = (<CompletionList>completions)?.itemDefaults?.data;

            // There are times when the generated code will not line up with the content of the .razor/.cshtml file.
            // Therefore, we need to offset all completion items' characters by a certain amount in order
            // to have proper completion. An example of this is typing @DateTime at the beginning of a line.
            // In the code behind it's represented as __o = DateTime.
            const completionCharacterOffset = projectedPosition.character - hostDocumentPosition.character;
            for (const completionItem of completionItems) {
                const doc = completionItem.documentation as vscode.MarkdownString;
                if (doc && doc.value) {
                    // Without this, the documentation doesn't get rendered in the editor.
                    const newDoc = new vscode.MarkdownString(doc.value);
                    newDoc.isTrusted = doc.isTrusted;
                    completionItem.documentation = newDoc;
                }

                if (completionItem.range) {
                    const range = completionItem.range;
                    const insertingRange = (range as any).inserting;
                    if (insertingRange) {
                        const insertingRangeStart = this.offsetColumn(completionCharacterOffset, hostDocumentPosition.line, insertingRange.start);
                        const insertingRangeEnd = this.offsetColumn(completionCharacterOffset, hostDocumentPosition.line, insertingRange.end);
                        (range as any).inserting = new vscode.Range(insertingRangeStart, insertingRangeEnd);
                    }

                    const replacingRange = (range as any).replacing;
                    if (replacingRange) {
                        const replacingRangeStart = this.offsetColumn(completionCharacterOffset, hostDocumentPosition.line, replacingRange.start);
                        const replacingRangeEnd = this.offsetColumn(completionCharacterOffset, hostDocumentPosition.line, replacingRange.end);
                        (range as any).replacing = new vscode.Range(replacingRangeStart, replacingRangeEnd);
                    }

                    if (range instanceof vscode.Range && range.start && range.end) {
                        const rangeStart = this.offsetColumn(completionCharacterOffset, hostDocumentPosition.line, range.start);
                        const rangeEnd = this.offsetColumn(completionCharacterOffset, hostDocumentPosition.line, range.end);
                        completionItem.range = new vscode.Range(rangeStart, rangeEnd);
                    }
                }

                // textEdit is deprecated in favor of .range. Clear out its value to avoid any unexpected behavior.
                completionItem.textEdit = undefined;

                if (context.triggerCharacter === '@' &&
                    completionItem.commitCharacters) {
                    // We remove `{`, '(', and '*' from the commit characters to prevent auto-completing the first
                    // completion item with a curly brace when a user intended to type `@{}` or `@()`.
                    completionItem.commitCharacters = completionItem.commitCharacters.filter(
                        commitChar => commitChar !== '{' && commitChar !== '(' && commitChar !== '*');
                }

                // for intellicode items, manually set the insertText to avoid including stars in the commit
                if (completionItem.label.toString().includes('\u2605')){
                    // vscode.CompletionItem does not have textEditText, which was added in 3.17
                    let intellicodeCompletion: CompletionItem = completionItem as CompletionItem;
                    if (intellicodeCompletion.textEditText){
                        completionItem.insertText = intellicodeCompletion.textEditText;
                    }
                }

                if (!(<CompletionItem>completionItem).data) {
                    (<CompletionItem>completionItem).data = data;
                }
            }

            const isIncomplete = completions instanceof Array ? false
                : completions ? completions.isIncomplete
                    : false;
            return new vscode.CompletionList(completionItems, isIncomplete);
        }
    }

    private static offsetColumn(offset: number, hostDocumentLine: number, projectedPosition: vscode.Position) {
        const offsetPosition = new vscode.Position(
            hostDocumentLine,
            projectedPosition.character - offset);
        return offsetPosition;
    }

    constructor(
        documentSynchronizer: RazorDocumentSynchronizer,
        documentManager: RazorDocumentManager,
        serviceClient: RazorLanguageServiceClient,
        private readonly provisionalCompletionOrchestrator: ProvisionalCompletionOrchestrator,
        logger: RazorLogger) {
        super(documentSynchronizer, documentManager, serviceClient, logger);
    }

    public async provideCompletionItems(
        document: vscode.TextDocument, position: vscode.Position,
        token: vscode.CancellationToken, context: vscode.CompletionContext) {
        const projection = await this.getProjection(document, position, token);

        if (this.logger.verboseEnabled) {
            this.logger.logVerbose(`Providing completions for document ${getUriPath(document.uri)} ` +
                `at location (${position.line}, ${position.character})`);
        }

        if (!projection) {
            return { isIncomplete: true, items: [] } as vscode.CompletionList;
        }

        const provisionalCompletions = await this.provisionalCompletionOrchestrator.tryGetProvisionalCompletions(
            document.uri,
            projection,
            context);
        if (provisionalCompletions) {
            return provisionalCompletions;
        }

        // Not a provisional completion

        const completionList = await RazorCompletionItemProvider.getCompletions(
            projection.uri,
            position,
            projection.position,
            context,
            projection.languageKind);

        return completionList;
    }

    public async resolveCompletionItem(item: vscode.CompletionItem, token: vscode.CancellationToken): Promise<vscode.CompletionItem> {
        // We assume that only the RoslynLanguageServer provides data, which
        // if it does we use LSP calls directly to Roslyn since there's no
        // equivalent vscode command to generically do that.
        if ((<CompletionItem>item).data) {
            let newItem = await vscode
                .commands
                .executeCommand<vscode.CompletionItem>(
                    RoslynLanguageServer.resolveCompletionsCommand,
                    item);

            if (!newItem) {
                return item;
            }

            item = newItem;

            // The documentation object Roslyn returns can have a different
            // shape than what the client expects, so we do a conversion here.
            const markdownString = <vscode.MarkdownString>(item.documentation);
            if (markdownString && markdownString.value) {
                item.documentation = new vscode.MarkdownString(markdownString.value);
            }

            if (item.command && item.command.arguments?.length === 4) {
                let uri = vscode.Uri.parse(item.command.arguments[0]);

                if (uri && RazorConventions.isRazorCSharpFile(uri)) {
                    let razorUri = RazorConventions.getRazorDocumentUri(uri);
                    let textEdit = item.command.arguments[1] as vscode.TextEdit;

                    let remappedEdit = await MappingHelpers.remapGeneratedFileTextEdit(razorUri, textEdit, this.serviceClient, this.logger, token);

                    if (remappedEdit) {
                        item.command.arguments[0] = razorUri;
                        item.command.arguments[1] = remappedEdit;
                    }
                }
            }
        }

        return item;
    }
}

function getTriggerKind(triggerKind: vscode.CompletionTriggerKind): CompletionTriggerKind {
    switch (triggerKind) {
        case vscode.CompletionTriggerKind.Invoke:
            return CompletionTriggerKind.Invoked;
        case vscode.CompletionTriggerKind.TriggerCharacter:
            return CompletionTriggerKind.TriggerCharacter;
        case vscode.CompletionTriggerKind.TriggerForIncompleteCompletions:
            return CompletionTriggerKind.TriggerForIncompleteCompletions;
        default:
            throw new Error(`Unexpected completion trigger kind: ${triggerKind}`);

    }
}
