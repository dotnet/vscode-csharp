/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode } from "./vscodeAdapter";

export default class NetworkSettings {
    constructor(public readonly proxy: string, public readonly strictSSL: boolean) {
    }
}

export interface NetworkSettingsProvider {
    (): NetworkSettings;
}

export function vscodeNetworkSettingsProvider(vscode: vscode): NetworkSettingsProvider {
    return () => {
        const config = vscode.workspace.getConfiguration();
        const proxy = config.get<string>('http.proxy');
        const strictSSL = config.get('http.proxyStrictSSL', true);
        return new NetworkSettings(proxy, strictSSL);
    };
}