/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../vscodeAdapter';
import { LaunchTarget } from '../launcher';
import { LaunchInfo } from '../OmnisharpManager';
import { Options } from '../options';
import Disposable from '../../Disposable';

export interface IEngine {
    start(
        cwd: string,
        args: string[],
        launchTarget: LaunchTarget,
        launchInfo: LaunchInfo,
        options: Options
    ): Promise<void>;
    stop(): Promise<void>;
    waitForInitialize(): Promise<void>;
    dispose(): void;
    makeRequest<TResponse>(
        command: string,
        data?: any,
        token?: CancellationToken
    ): Promise<TResponse>;
    addListener<T = {}>(event: string, listener: (e: T) => void): Disposable;
}
