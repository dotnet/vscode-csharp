/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IHostExecutableResolver } from "../../../src/constants/IHostExecutableResolver";
import { HostExecutableInformation } from "../../../src/constants/HostExecutableInformation";

export const fakeMonoInfo: HostExecutableInformation = {
    version: "someMonoVersion",
    path: "somePath",
    env: undefined
};

export class FakeMonoResolver implements IHostExecutableResolver {
    public getGlobalMonoCalled: boolean;

    constructor(public willReturnMonoInfo = true) {
        this.getGlobalMonoCalled = false;
    }

    async getHostExecutableInfo(): Promise<HostExecutableInformation> {
        this.getGlobalMonoCalled = true;
        if (this.willReturnMonoInfo) {
            return Promise.resolve(fakeMonoInfo);
        }

        return Promise.resolve(undefined);
    }
}
