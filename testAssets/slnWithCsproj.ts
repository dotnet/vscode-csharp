import { IWorkspace } from "./workspaces";

let workspace: IWorkspace = {
    projects: [{
        relativePath: "src/app/app.csproj"
    },{
        relativePath: "src/lib/lib.csproj"
    },{
        relativePath: "test/test.csproj"
    }]
};

export default workspace;