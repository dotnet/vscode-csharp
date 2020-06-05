/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IGetDotnetInfo } from "../../../src/constants/IGetDotnetInfo";
import { DotnetInfo } from "../../../src/utils/getDotnetInfo";

export const fakeDotnetInfo: DotnetInfo = {
    FullInfo: "myDotnetInfo",
    Version: "1.0.x",
    OsVersion: "Fake86",
    RuntimeId: "1.1.x"
};
export const FakeGetDotnetInfo: IGetDotnetInfo = async () => Promise.resolve(fakeDotnetInfo);