import * as vscode from 'vscode';
import * as serverUtils from '../omnisharp/utils';
import { OmniSharpServer } from '../omnisharp/server';
import { FixAllScope } from '../omnisharp/protocol';
import { WorkspaceEdit } from 'vscode';

export class FixAllProvider implements vscode.CodeActionProvider {
    public constructor(private server: OmniSharpServer) {
    }

    public async provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        _token: vscode.CancellationToken,
    ): Promise<vscode.CodeAction[]> {
        console.log(context);
        if (!context.only) {
            return [];
        }

        if (context.only.value === "source.fixAll.csharp") {
            let response = await serverUtils.runFixAll(this.server, { FileName: document.fileName, Scope: FixAllScope.Document, FixAllFilter: undefined });

            response.Changes.forEach(change => {
                const uri = vscode.Uri.file(change.FileName);

                let edits: WorkspaceEdit = new WorkspaceEdit();
                change.Changes.forEach(change => {
                    edits.replace(uri,
                        new vscode.Range(change.StartLine - 1, change.StartColumn - 1, change.EndLine - 1, change.EndColumn - 1),
                        change.NewText);
                });

                vscode.workspace.applyEdit(edits);
            });
        }
        return undefined;
    }
}