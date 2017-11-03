import * as vscode from "vscode";

export {Disposable, ExtensionContext, ShellExecution, Task, TaskDefinition, TaskGroup, WorkspaceFolder} from "vscode";

export interface ITaskProviderRegistration {
    type: string;
    provider: vscode.TaskProvider;
}

class tasksWorkspaceAdapter {
    get workspaceFolders(): vscode.WorkspaceFolder[] {
        return vscode.workspace.workspaceFolders;
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

export const workspace = new tasksWorkspaceAdapter();

let registeredTaskProvider: ITaskProviderRegistration;

export function getRegisteredTaskProvider(): ITaskProviderRegistration {
    return registeredTaskProvider;
}