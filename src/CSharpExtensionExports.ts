/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Advisor } from "./features/diagnosticsProvider";
import { EventStream } from "./EventStream";
import TestManager from "./features/dotnetTest";
import { GlobalBrokeredServiceContainer } from "@microsoft/servicehub-framework";

export interface OmnisharpExtensionExports {
    initializationFinished: () => Promise<void>;
    getAdvisor: () => Promise<Advisor>;
    getTestManager: () => Promise<TestManager>;
    eventStream: EventStream;
    logDirectory: string;
}

export interface CSharpExtensionExports {
    initializationFinished: () => Promise<void>;
    logDirectory: string;
    profferBrokeredServices: (container: GlobalBrokeredServiceContainer) => void;
}
