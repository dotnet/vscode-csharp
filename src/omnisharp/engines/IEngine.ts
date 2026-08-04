/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../vscodeAdapter.ts';
import { LaunchTarget } from '../../shared/launchTarget.ts';
import Disposable from '../../disposable.ts';
import { OmniSharpServer } from '../server.ts';
import { LanguageMiddlewareFeature } from '../languageMiddlewareFeature.ts';
import { Advisor } from '../features/diagnosticsProvider.ts';
import TestManager from '../features/dotnetTest.ts';
import { EventStream } from '../../eventStream.ts';

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
