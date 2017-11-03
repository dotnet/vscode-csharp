import { ITestAssetWorkspace } from "./testAssets";

let workspace: ITestAssetWorkspace = {
    description: "sln with several csproj's",
    projects: [{
        relativePath: "src/app/app.csproj"
    },{
        relativePath: "src/lib/lib.csproj"
    },{
        relativePath: "test/test.csproj"
    }]
};

export default workspace;