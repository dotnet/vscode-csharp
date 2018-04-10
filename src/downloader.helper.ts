/*---------------------------------------------------------------------------------------------
* Copyright (c) Microsoft Corporation. All rights reserved.
* Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import { vscode } from "./vscodeAdapter";

export function GetNetworkConfiguration(vscode: vscode) {
    const config = vscode.workspace.getConfiguration();
    const proxy = config.get<string>('http.proxy');
    const strictSSL = config.get('http.proxyStrictSSL', true);
    return { Proxy: proxy, StrictSSL: strictSSL };
}