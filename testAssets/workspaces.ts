import * as fs from 'async-file';
import * as path from 'path';
import * as vscode from 'vscode';

let workspace: IWorkspace = {
    projects: [{
        relativePath: ""
    }]
};

export class Project {
    constructor(project: IProject) {
        this.relativePath = project.relativePath;
    }
    
    relativePath: string;

    get projectDirectoryPath(): string {
        return path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, 
                            this.relativePath);
    }

    get binDirectoryPath(): string {
        return path.resolve(this.projectDirectoryPath, 'bin');
    }

    get objDirectoryPath(): string {
        return path.resolve(this.projectDirectoryPath, 'obj');
    }

    async deleteBuildArtifacts(): Promise<void> {
        await fs.rimraf(this.binDirectoryPath);
        await fs.rimraf(this.objDirectoryPath);
    }
}

export class Workspace {
    constructor(workspace: IWorkspace) {
        this.projects = workspace.projects.map(
            w => new Project(w)
        );

        this.name = "single csproj at root of workspace";

        this.workspaceDirectory = "singleCsproj";
    }

    async deleteBuildArtifacts(): Promise<void> {
        this.projects.forEach(async p => await p.deleteBuildArtifacts());
    }

    name: string;

    projects: Project [];

    workspaceDirectory: string;
}

export interface IWorkspace {
    projects: IProject[];
}

export interface IProject {
    relativePath: string;
}

export default new Workspace(workspace);