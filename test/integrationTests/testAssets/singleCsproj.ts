import { ITestAssetWorkspace } from "./testAssets";

let workspace: ITestAssetWorkspace = {
    description: "single csproj at root of workspace",
    projects: [{
        relativePath: "singleCsproj.csproj"
    }]
};

export default workspace;