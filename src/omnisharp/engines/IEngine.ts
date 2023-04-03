/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../vscodeAdapter';
import { LaunchTarget } from "../../shared/LaunchTarget";
import { Options } from '../../shared/options';
import Disposable from '../../Disposable';
import { OmniSharpServer } from '../server';
import { LanguageMiddlewareFeature } from '../LanguageMiddlewareFeature';
import OptionProvider from '../../shared/observers/OptionProvider';
import { Advisor } from '../../features/diagnosticsProvider';
import TestManager from '../../features/dotnetTest';
import { EventStream } from '../../EventStream';

export interface IEngine {
    start(
        cwd: string,
        args: string[],
        launchTarget: LaunchTarget,
        launchPath: string,
        options: Options,
    ): Promise<void>;
    stop(): Promise<void>;
    registerProviders(
        server: OmniSharpServer,
        optionProvider: OptionProvider,
        languageMiddlewareFeature: LanguageMiddlewareFeature,
        eventStream: EventStream,
        advisor: Advisor,
        testManager: TestManager,
    ): Promise<Disposable>;
    waitForInitialize(): Promise<void>;
    dispose(): void;
    makeRequest<TResponse>(
        command: string,
        data?: any,
        token?: CancellationToken,
    ): Promise<TResponse>;
    addListener<T = {}>(event: string, listener: (e: T) => void): Disposable;
}
