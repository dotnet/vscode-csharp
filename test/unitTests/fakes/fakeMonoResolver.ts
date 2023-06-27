/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IHostExecutableResolver } from '../../../src/shared/constants/IHostExecutableResolver';
import { HostExecutableInformation } from '../../../src/shared/constants/hostExecutableInformation';

export const fakeMonoInfo: HostExecutableInformation = {
    version: 'someMonoVersion',
    path: 'somePath',
    env: {},
};

export class FakeMonoResolver implements IHostExecutableResolver {
    public getMonoCalled: boolean;

    constructor(public willReturnMonoInfo = true) {
        this.getMonoCalled = false;
    }

    async getHostExecutableInfo(): Promise<HostExecutableInformation> {
        this.getMonoCalled = true;
        if (this.willReturnMonoInfo) {
            return Promise.resolve(fakeMonoInfo);
        }

        return Promise.resolve(undefined!);
    }
}
