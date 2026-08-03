/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../vscodeAdapter.js';
import { LaunchTarget } from '../../shared/launchTarget.js';
import Disposable from '../../disposable.js';
import { OmniSharpServer } from '../server.js';
import { LanguageMiddlewareFeature } from '../languageMiddlewareFeature.js';
import { Advisor } from '../features/diagnosticsProvider.js';
import TestManager from '../features/dotnetTest.js';
import { EventStream } from '../../eventStream.js';

export interface IEngine {
    start(cwd: string, args: string[], launchTarget: LaunchTarget, launchPath: string): Promise<void>;
    stop(): Promise<void>;
    registerProviders(
        server: OmniSharpServer,
        languageMiddlewareFeature: LanguageMiddlewareFeature,
        eventStream: EventStream,
        advisor: Advisor,
        testManager: TestManager
    ): Promise<Disposable>;
    waitForInitialize(): Promise<void>;
    dispose(): void;
    makeRequest<TResponse>(command: string, data?: any, token?: CancellationToken): Promise<TResponse>;
    addListener<T = object>(event: string, listener: (e: T) => void): Disposable;
}
