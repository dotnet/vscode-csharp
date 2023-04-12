/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GlobalBrokeredServiceContainer, IRemoteServiceBroker, IServiceBroker, ServiceAudience, ServiceMoniker, ServiceRegistration } from '@microsoft/servicehub-framework';
import Descriptors from './CSharpDevKitDescriptors';

export class CSharpExtensionServiceBroker extends GlobalBrokeredServiceContainer {
    registerExternalServices(...monikers: ServiceMoniker[]) {
        const externalRegistration = new ServiceRegistration(ServiceAudience.local, false);
        this.register(monikers.map(mk => { return { moniker: mk, registration: externalRegistration }; }));
    }
}

let _csharpExtensionServiceBroker: CSharpExtensionServiceBroker;
export function getBrokeredServiceContainer(): CSharpExtensionServiceBroker {
    if (!_csharpExtensionServiceBroker) {
        _csharpExtensionServiceBroker = new CSharpExtensionServiceBroker();
        // Register any brokered services that come from other extensions so that we can proffer them later.
        _csharpExtensionServiceBroker.registerExternalServices(Descriptors.helloWorld.moniker);
    }
    return _csharpExtensionServiceBroker;
}

export function getServiceBroker(): IServiceBroker & IRemoteServiceBroker {
    return getBrokeredServiceContainer().getFullAccessServiceBroker();
}