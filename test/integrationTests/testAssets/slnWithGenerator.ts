/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITestAssetWorkspace } from "./testAssets";

let workspace: ITestAssetWorkspace = {
    description: "sln with a source generator",
    projects: [{
        relativeFilePath: "app/app.csproj"
    }, {
        relativeFilePath: "generator/generator.csproj"
    }]
};

export default workspace;
