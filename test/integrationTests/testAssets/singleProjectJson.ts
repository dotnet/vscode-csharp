import { IWorkspace } from "./workspaces";

let workspace: IWorkspace = {
    description: "single project.json at root of workspace",
    projects: [{
        relativePath: "project.json"
    }]
};

export default workspace;