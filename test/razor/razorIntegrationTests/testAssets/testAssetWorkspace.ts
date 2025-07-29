/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITestAssetWorkspace, TestAssetWorkspace } from '../../../lsptoolshost/integrationTests/testAssets/testAssets';

const workspace: ITestAssetWorkspace = {
    description: 'Basic Razor app',
    projects: [
        {
            relativeFilePath: 'RazorApp.csproj',
        },
    ],
};

const activeTestAssetWorkspace = new TestAssetWorkspace(workspace);

export default activeTestAssetWorkspace;
