/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITestAssetWorkspace } from "./testAssets";

let workspace: ITestAssetWorkspace = {
    description: "sln with several csproj's",
    projects: [{
        relativeFilePath: "src/app/app.csproj"
    },{
        relativeFilePath: "src/lib/lib.csproj"
    },{
        relativeFilePath: "test/test.csproj"
    }]
};

export default workspace;