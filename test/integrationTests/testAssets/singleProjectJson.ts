import { ITestAssetWorkspace } from "./testAssets";

let workspace: ITestAssetWorkspace = {
    description: "single project.json at root of workspace",
    projects: [{
        relativePath: "project.json"
    }]
};

export default workspace;