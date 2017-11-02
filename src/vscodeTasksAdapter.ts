import * as vscode from "vscode";

export {Disposable, ExtensionContext, ShellExecution, Task, TaskDefinition, TaskGroup, WorkspaceFolder} from "vscode";

export interface IRegisteredTaskProvider {
    type: string;
    provider: vscode.TaskProvider;
}

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

let registeredTaskProvider: IRegisteredTaskProvider;

function sleep(ms = 0) {
    return new Promise(r => setTimeout(r, ms));
}

export async function getRegisteredTaskProvider(timeout: number = 1000): Promise<IRegisteredTaskProvider> {
    return poll(() => !!registeredTaskProvider, () => registeredTaskProvider, timeout, 100);
}

export async function poll<T>(condition: () => boolean, value: () => T, duration: number, step: number): Promise<T> {
    while (duration > 0) {
        if (condition()) {
            return value();
        }

        await sleep(step);

        duration -= step;
    }

    throw new Error("Polling did not succeed within the alotted duration.");
}