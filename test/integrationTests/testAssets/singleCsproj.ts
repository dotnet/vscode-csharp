import { IWorkspace } from "./workspaces";

let workspace: IWorkspace = {
    description: "single csproj at root of workspace",
    projects: [{
        relativePath: "singleCsproj.csproj"
    }]
};

export default workspace;