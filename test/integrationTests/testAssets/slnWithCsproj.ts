/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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