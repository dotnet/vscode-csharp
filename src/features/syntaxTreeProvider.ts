/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as serverUtils from '../omnisharp/utils';
import { SyntaxNodeInfoResponse, SyntaxTreeNode, V2 } from '../omnisharp/protocol';
import { OmniSharpServer } from '../omnisharp/server';
import CompositeDisposable from '../CompositeDisposable';
import { assert } from 'console';

const highlightEditorRangeCommand: string = 'csharp.syntaxTreeVisualizer.highlightRange';
const clearHighlightCommand: string = 'csharp.syntaxTreeVisualizer.clearHighlight';

export function createSyntaxTreeVisualizer(server: OmniSharpServer): CompositeDisposable {
    const syntaxTreeProvider = new SyntaxTreeProvider(server);
    const treeView = vscode.window.createTreeView('syntaxTree', { treeDataProvider: syntaxTreeProvider });
    const propertyTreeProvider = new SyntaxNodePropertyTreeProvider();
    const propertyViewDisposable = vscode.window.registerTreeDataProvider('syntaxProperties', propertyTreeProvider);

    const editorTextSelectionChangeDisposable = vscode.window.onDidChangeTextEditorSelection(async event => {
        if (treeView.visible && event.selections.length > 0) {
            const firstSelection = event.selections[0];
            const range: V2.Range = { Start: { Line: firstSelection.start.line, Column: firstSelection.start.character }, End: { Line: firstSelection.end.line, Column: firstSelection.end.character } };
            const response = await serverUtils.getSyntaxNodeAtRange(server, { FileName: event.textEditor.document.fileName, Range: range });

            if (!response || !response.Node) {
                return;
            }

            await treeView.reveal(response.Node);
            await vscode.commands.executeCommand(highlightEditorRangeCommand, response.Node.Range);
        }
    });

    const treeViewVisibilityDisposable = treeView.onDidChangeVisibility(async (event) => {
        if (!event.visible) {
            propertyTreeProvider.setSyntaxNodeInfo(undefined);
            await vscode.commands.executeCommand(clearHighlightCommand);
        }
    });

    const treeViewSelectionChangedDisposable = treeView.onDidChangeSelection(async (event) => {
        if (event.selection && event.selection.length > 0) {
            const info = await serverUtils.getSyntaxNodeInfo(server, { Node: event.selection[0] });
            propertyTreeProvider.setSyntaxNodeInfo(info);
        }
        else {
            propertyTreeProvider.setSyntaxNodeInfo(undefined);
        }
    });

    return new CompositeDisposable(treeView, propertyViewDisposable, editorTextSelectionChangeDisposable, treeViewVisibilityDisposable, treeViewSelectionChangedDisposable);
}

class SyntaxTreeProvider implements vscode.TreeDataProvider<SyntaxTreeNode>, vscode.Disposable {

    private readonly _wordHighlightBackground: vscode.ThemeColor;
    private readonly _wordHighlightBorder: vscode.ThemeColor;
    private readonly _decorationType: vscode.TextEditorDecorationType;
    private readonly _disposables: CompositeDisposable;
    private readonly _onDidChangeTreeData: vscode.EventEmitter<SyntaxTreeNode | undefined> = new vscode.EventEmitter<SyntaxTreeNode | undefined>();

    constructor(private server: OmniSharpServer) {

        this._wordHighlightBackground = new vscode.ThemeColor('editor.wordHighlightBackground');
        this._wordHighlightBorder = new vscode.ThemeColor('editor.wordHighlightBorder');
        this._decorationType = vscode.window.createTextEditorDecorationType({ backgroundColor: this._wordHighlightBackground, borderColor: this._wordHighlightBorder });

        const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
            this._onDidChangeTreeData.fire();
        });

        const textDocumentChangedDisposable = vscode.workspace.onDidChangeTextDocument(async event => {
            this._onDidChangeTreeData.fire();
        });

        const highlightRangeCommandDisposable = vscode.commands.registerCommand(highlightEditorRangeCommand, (node) => this._highlightRange(node), this);
        const clearHighlightCommandDisposable = vscode.commands.registerCommand(clearHighlightCommand, () => this._clearHighlight(), this);

        this._disposables = new CompositeDisposable(activeEditorDisposable, textDocumentChangedDisposable, highlightRangeCommandDisposable, clearHighlightCommandDisposable, this._onDidChangeTreeData);
    }

    readonly onDidChangeTreeData: vscode.Event<SyntaxTreeNode | undefined> = this._onDidChangeTreeData.event;

    getTreeItem(element: SyntaxTreeNode): vscode.TreeItem {
        let treeItem = new vscode.TreeItem(`${element.NodeType.Symbol}`, element.HasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        treeItem.description = `[${element.Range.Start.Line}:${element.Range.Start.Column}-${element.Range.End.Line}:${element.Range.End.Column})`;
        treeItem.command = { "title": "Highlight Range", command: highlightEditorRangeCommand, arguments: [element.Range] };
        treeItem.iconPath = omnisharpSymbolKindToIcon.get(element.NodeType.SymbolKind);
        treeItem.id = `${element.Id}`;

        return treeItem;
    }

    async getChildren(element?: SyntaxTreeNode): Promise<SyntaxTreeNode[]> {
        const activeDoc = vscode.window.activeTextEditor?.document.uri.fsPath;

        if (!activeDoc || !activeDoc.endsWith(".cs")) {
            // Not a C# file, don't display anything
            return [];
        }

        const children = await serverUtils.getSyntaxTree(this.server, { FileName: activeDoc, Parent: element });

        if (!children || !Array.isArray(children.TreeItems)) {
            return [];
        }

        return children.TreeItems;
    }

    async getParent(element: SyntaxTreeNode): Promise<SyntaxTreeNode | undefined> {
        const response = await serverUtils.getSyntaxNodeParent(this.server, { Child: element });
        if (!response || !response.Parent) {
            return undefined;
        }

        return response.Parent;
    }

    private _highlightRange(range: V2.Range) {
        const vscodeRange = new vscode.Range(
            new vscode.Position(range.Start.Line, range.Start.Column),
            new vscode.Position(range.End.Line, range.End.Column));

        vscode.window.activeTextEditor.setDecorations(this._decorationType, [vscodeRange]);
    }

    private _clearHighlight() {
        const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));
        vscode.window.activeTextEditor.setDecorations(this._decorationType, [range]);
    }

    dispose() {
        this._disposables.dispose();
    }
}

const classIcon = new vscode.ThemeIcon('symbol-class');
const structIcon = new vscode.ThemeIcon('symbol-struct');
const enumMemberIcon = new vscode.ThemeIcon('symbol-enum-member');

const omnisharpSymbolKindToIcon: Map<V2.OmnisharpSymbolKind, vscode.ThemeIcon> = new Map();
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Array, new vscode.ThemeIcon('symbol-array'));
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Class, classIcon);
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Delegate, classIcon);
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Enum, new vscode.ThemeIcon('symbol-enum'));
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Interface, new vscode.ThemeIcon('symbol-interface'));
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Struct, structIcon);
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.TypeParameter, new vscode.ThemeIcon('symbol-type-parameter'));
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Constant, new vscode.ThemeIcon('symbol-constant'));
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Constructor, new vscode.ThemeIcon('symbol-constructor'));
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Destructor, new vscode.ThemeIcon('symbol-constructor'));
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.EnumMember, enumMemberIcon);
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Event, new vscode.ThemeIcon('symbol-event'));
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Field, new vscode.ThemeIcon('symbol-field'));
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Indexer, new vscode.ThemeIcon('symbol-property'));
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Method, new vscode.ThemeIcon('symbol-method'));
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Operator, new vscode.ThemeIcon('symbol-operator'));
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Parameter, new vscode.ThemeIcon('symbol-parameter'));
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Property, new vscode.ThemeIcon('symbol-property'));
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Namespace, new vscode.ThemeIcon('symbol-namespace'));
omnisharpSymbolKindToIcon.set(V2.OmnisharpSymbolKind.Unknown, new vscode.ThemeIcon('symbol-misc'));

enum SyntaxNodePropertyCategory {
    TypeInfoHeader,
    SymbolInfoHeader,
    CandidateSymbolsHeader,
    DeclaredSymbolHeader,
    PropertiesHeader,
    LeafNode
}

interface SyntaxNodeProperty {
    category: SyntaxNodePropertyCategory;
    title: string;
    hasChildren: boolean;
    icon?: vscode.ThemeIcon;
    description?: string;
}

class SyntaxNodePropertyTreeProvider implements vscode.TreeDataProvider<SyntaxNodeProperty> {
    private _syntaxNodeInfo?: SyntaxNodeInfoResponse;
    private _onDidChangeTreeData: vscode.EventEmitter<SyntaxNodeProperty | undefined> = new vscode.EventEmitter<SyntaxNodeProperty | undefined>();
    readonly onDidChangeTreeData: vscode.Event<SyntaxNodeProperty | undefined> = this._onDidChangeTreeData.event;

    public setSyntaxNodeInfo(newInfo?: SyntaxNodeInfoResponse) {
        this._syntaxNodeInfo = newInfo;
        this._onDidChangeTreeData.fire();
    }

    getChildren(element?: SyntaxNodeProperty): SyntaxNodeProperty[] | undefined {
        if (!this._syntaxNodeInfo) {
            return undefined;
        }

        if (!element) {
            let categories: SyntaxNodeProperty[] = [
                leafNode('Node Type:', this._syntaxNodeInfo.NodeType.Symbol, this._syntaxNodeInfo.NodeType.SymbolKind),
                leafNode('SyntaxKind:', this._syntaxNodeInfo.NodeSyntaxKind, V2.OmnisharpSymbolKind.EnumMember),
            ];

            if (this._syntaxNodeInfo.SemanticClassification) {
                categories.push(leafNode('Semantic Classification', this._syntaxNodeInfo.SemanticClassification));
            }

            if (this._syntaxNodeInfo.NodeTypeInfo) {
                categories.push({ category: SyntaxNodePropertyCategory.TypeInfoHeader, title: 'Type Info', hasChildren: true });
            }
            else {
                categories.push({ category: SyntaxNodePropertyCategory.TypeInfoHeader, title: 'Type Info:', description: '<null>', hasChildren: false });
            }

            if (this._syntaxNodeInfo.NodeSymbolInfo) {
                categories.push({ category: SyntaxNodePropertyCategory.SymbolInfoHeader, title: 'Symbol Info', hasChildren: true });
            }
            else {
                categories.push({ category: SyntaxNodePropertyCategory.SymbolInfoHeader, title: 'Symbol Info:', description: '<null>', hasChildren: false });
            }

            categories.push({
                category: SyntaxNodePropertyCategory.DeclaredSymbolHeader,
                title: 'Declared Symbol:',
                description: this._syntaxNodeInfo.NodeDeclaredSymbol.Symbol,
                icon: this._syntaxNodeInfo.NodeDeclaredSymbol.SymbolKind
                    ? omnisharpSymbolKindToIcon.get(this._syntaxNodeInfo.NodeDeclaredSymbol.SymbolKind)
                    : undefined,
                hasChildren: false
            });

            categories.push({
                category: SyntaxNodePropertyCategory.PropertiesHeader,
                title: 'Properties',
                hasChildren: Object.keys(this._syntaxNodeInfo.Properties).length !== 0
            });

            return categories;
        }

        switch (element.category) {
            case SyntaxNodePropertyCategory.DeclaredSymbolHeader:
            case SyntaxNodePropertyCategory.LeafNode:
                return undefined;

            case SyntaxNodePropertyCategory.TypeInfoHeader:
                assert(this._syntaxNodeInfo.NodeTypeInfo);
                return [
                    leafNode('Type:', this._syntaxNodeInfo.NodeTypeInfo.Type.Symbol, this._syntaxNodeInfo.NodeTypeInfo.Type.SymbolKind),
                    leafNode('ConvertedType:', this._syntaxNodeInfo.NodeTypeInfo.ConvertedType.Symbol, this._syntaxNodeInfo.NodeTypeInfo.ConvertedType.SymbolKind),
                    leafNode('Conversion:', this._syntaxNodeInfo.NodeTypeInfo.Conversion)
                ];

            case SyntaxNodePropertyCategory.SymbolInfoHeader:
                assert(this._syntaxNodeInfo.NodeSymbolInfo);
                let symbolInfoNodes = [
                    leafNode('Symbol:', this._syntaxNodeInfo.NodeSymbolInfo.Symbol.Symbol, this._syntaxNodeInfo.NodeSymbolInfo.Symbol.SymbolKind),
                    leafNode('Candidate Reason:', this._syntaxNodeInfo.NodeSymbolInfo.CandidateReason)
                ];

                if (this._syntaxNodeInfo.NodeSymbolInfo.CandidateSymbols.length > 0) {
                    symbolInfoNodes.push({ category: SyntaxNodePropertyCategory.CandidateSymbolsHeader, title: 'Candidate Symbols', hasChildren: true });
                }
                else {
                    symbolInfoNodes.push(leafNode('Candidate Symbols', 'None'));
                }

                return symbolInfoNodes;

            case SyntaxNodePropertyCategory.CandidateSymbolsHeader:
                assert(this._syntaxNodeInfo.NodeSymbolInfo.CandidateSymbols.length > 0);
                return this._syntaxNodeInfo.NodeSymbolInfo.CandidateSymbols.map(s => leafNode(s.Symbol, undefined, s.SymbolKind));

            case SyntaxNodePropertyCategory.PropertiesHeader:
                let properties: SyntaxNodeProperty[] = [];
                for (const key of Object.keys(this._syntaxNodeInfo.Properties)) {
                    properties.push(leafNode(key, this._syntaxNodeInfo.Properties[key]));
                }

                return properties;
        }
    }

    getTreeItem(property: SyntaxNodeProperty): vscode.TreeItem {
        const collapsibleState = property.hasChildren
            ? (property.category === SyntaxNodePropertyCategory.PropertiesHeader ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded)
            : vscode.TreeItemCollapsibleState.None;

        let treeItem = new vscode.TreeItem(property.title, collapsibleState);
        treeItem.iconPath = property.icon;
        treeItem.description = property.description;

        return treeItem;
    }
}

function leafNode(title: string, description?: string, symbolKind?: V2.OmnisharpSymbolKind): SyntaxNodeProperty {
    return {
        category: SyntaxNodePropertyCategory.LeafNode,
        hasChildren: false,
        title,
        description,
        icon: symbolKind ? omnisharpSymbolKindToIcon.get(symbolKind) : undefined
    };
}
