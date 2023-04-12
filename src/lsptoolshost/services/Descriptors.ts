/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Formatters, MessageDelimiters, ServiceJsonRpcDescriptor, ServiceMoniker, ServiceRpcDescriptor } from '@microsoft/servicehub-framework';

export default class Descriptors {
    /**
     * The descriptor for Roslyn solution snapshot service.
     * Use {@link ISolutionSnapshotProvider} for the RPC interface.
     */
    static readonly solutionSnapshotProviderRegistration: ServiceRpcDescriptor = Object.freeze(
        new ServiceJsonRpcDescriptor(
            ServiceMoniker.create('Microsoft.VisualStudio.LanguageServer.SolutionSnapshotProvider', '0.1'),
            Formatters.Utf8,
            MessageDelimiters.HttpLikeHeaders,
        ),
    );
}
