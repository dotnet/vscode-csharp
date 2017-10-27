import * as vscode from "vscode";

export {Disposable, ExtensionContext, ShellExecution, Task, TaskDefinition, TaskGroup, WorkspaceFolder} from "vscode";

export interface IRegisteredTaskProvider {
    type: string;
    provider: vscode.TaskProvider;
}

let registeredTaskProvider: IRegisteredTaskProvider;

class workspaceAdapter {
    get workspaceFolders(): vscode.WorkspaceFolder[] {
        return vscode.workspace.workspaceFolders;
    }

    set workspaceFolders(workspaceFolders: vscode.WorkspaceFolder[]) {
        vscode.workspace.workspaceFolders = workspaceFolders;
    }

    registerTaskProvider(type: string, provider: vscode.TaskProvider): vscode.Disposable {
        registeredTaskProvider = {
            type,
            provider
        };
        
        return vscode.workspace.registerTaskProvider(type, provider);
    }

    getConfiguration(section?: string, resource?: vscode.Uri): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration();
    }
}

export const workspace = new workspaceAdapter();

export function getRegisteredTaskProvider() {
    return registeredTaskProvider;
}

