/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IHostExecutableResolver } from "../../../src/shared/constants/IHostExecutableResolver";
import { HostExecutableInformation } from "../../../src/shared/constants/HostExecutableInformation";

export const fakeMonoInfo: HostExecutableInformation = {
    version: "someDotNetVersion",
    path: "someDotNetPath",
    env: { }
};

export class FakeDotnetResolver implements IHostExecutableResolver {
    public getDotnetCalled: boolean;

    constructor(public willReturnDotnetInfo = true) {
        this.getDotnetCalled = false;
    }

    async getHostExecutableInfo(): Promise<HostExecutableInformation> {
        this.getDotnetCalled = true;
        if (this.willReturnDotnetInfo) {
            return Promise.resolve(fakeMonoInfo);
        }

        return Promise.resolve(undefined!);
    }
}
