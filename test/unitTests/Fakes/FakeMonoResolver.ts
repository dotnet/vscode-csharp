/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMonoResolver } from "../../../src/constants/IMonoResolver";
import { MonoInformation } from "../../../src/constants/MonoInformation";

export const fakeMonoInfo: MonoInformation = {
    version: "someMonoVersion",
    path: "somePath",
    env: undefined
};

export class FakeMonoResolver implements IMonoResolver {
    public getGlobalMonoCalled: boolean;

    constructor(public willReturnMonoInfo = true) {
        this.getGlobalMonoCalled = false;
    }

    async getGlobalMonoInfo(): Promise<MonoInformation> {
        this.getGlobalMonoCalled = true;
        if (this.willReturnMonoInfo) {
            return Promise.resolve(fakeMonoInfo);
        }

        return Promise.resolve(undefined);
    }
}