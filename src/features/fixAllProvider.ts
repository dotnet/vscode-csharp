import * as vscode from 'vscode';
import * as serverUtils from '../omnisharp/utils';
import * as protocol from '../omnisharp/protocol';
import { OmniSharpServer } from '../omnisharp/server';
import { FixAllScope, FixAllItem } from '../omnisharp/protocol';
import { WorkspaceEdit } from 'vscode';
import CompositeDisposable from '../CompositeDisposable';
import AbstractProvider from './abstractProvider';

export class FixAllProvider extends AbstractProvider implements vscode.CodeActionProvider {
    public constructor(private server: OmniSharpServer) {
        super(server);
        let disposable = new CompositeDisposable();
        disposable.add(vscode.commands.registerCommand('o.fixAll.solution', async () => this.fixAllTemporary(server, protocol.FixAllScope.Solution)));
        disposable.add(vscode.commands.registerCommand('o.fixAll.project', async () => this.fixAllTemporary(server, protocol.FixAllScope.Project)));
        disposable.add(vscode.commands.registerCommand('o.fixAll.document', async () => this.fixAllTemporary(server, protocol.FixAllScope.Document)));
        this.addDisposables(disposable);
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
            await this.applyFixes(document.fileName, FixAllScope.Document, undefined);
        }

        return [];
    }

    // This should be replaced with method that opens menu etc.
    private async fixAllTemporary(server: OmniSharpServer, scope: protocol.FixAllScope): Promise<void> {
    let availableFixes = await serverUtils.getFixAll(server, { FileName: vscode.window.activeTextEditor.document.fileName, Scope: scope });

    let targets = availableFixes.Items.map(x => `${x.Id}: ${x.Message}`);

    if (scope === protocol.FixAllScope.Document) {
        targets = ["Fix all issues", ...targets];
    }

    return vscode.window.showQuickPick(targets, {
        matchOnDescription: true,
        placeHolder: `Select fix all action`
    }).then(async selectedAction => {
        let filter: FixAllItem[] = undefined;

        if (selectedAction === undefined) {
            return;
        }

        if (selectedAction !== "Fix all issues") {
            let actionTokens = selectedAction.split(":");
            filter = [{ Id: actionTokens[0], Message: actionTokens[1] }]
        }

        await this.applyFixes(vscode.window.activeTextEditor.document.fileName, scope, filter);
    });
}

    private async applyFixes(fileName: string, scope: FixAllScope, fixAllFilter: FixAllItem[]): Promise<void>
    {
        let response = await serverUtils.runFixAll(this.server, { FileName: fileName, Scope: scope, FixAllFilter: fixAllFilter });

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
}