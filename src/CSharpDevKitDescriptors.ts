/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Formatters, MessageDelimiters, ServiceJsonRpcDescriptor, ServiceMoniker } from "@microsoft/servicehub-framework";

export default class CSharpDevKitDescriptors {
    /**
     * The descriptor for a sample brokered service that is hosted within the VS Code Extension Host process.
     * Use {@link IHelloWorld} for the RPC interface.
     */
    static readonly helloWorld = new ServiceJsonRpcDescriptor(
        ServiceMoniker.create('helloVSCodeExtensionHost', '1.0'),
        Formatters.Utf8,
        MessageDelimiters.HttpLikeHeaders,
    );
}