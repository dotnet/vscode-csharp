/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { EventStream } from '../../../../src/eventStream';
import { EventType } from '../../../../src/shared/eventType';
import { BaseEvent } from '../../../../src/shared/loggingEvents';
import { poll } from '../poll';
import { ITestAssetWorkspace, TestAssetWorkspace } from '../../../lsptoolshost/integrationTests/testAssets/testAssets';
import { ActivationResult } from '../integrationHelpers';

export class OmnisharpTestAssetWorkspace extends TestAssetWorkspace {
    constructor(workspace: ITestAssetWorkspace) {
        super(workspace);
    }

    async restore(): Promise<void> {
        await vscode.commands.executeCommand('dotnet.restore.all');
    }

    async restoreAndWait(activation: ActivationResult): Promise<void> {
        await this.restore();

        // Wait for activity to settle before proceeding
        await this.waitForIdle(activation.eventStream);
    }

    async waitForEvent<T extends BaseEvent>(
        stream: EventStream,
        captureType: EventType,
        stopCondition: (e: T) => boolean = (_) => true,
        timeout: number = 25 * 1000
    ): Promise<T | undefined> {
        let event: T | undefined = undefined;

        const subscription = stream.subscribe((e: BaseEvent) => {
            if (e.type === captureType) {
                const tEvent = <T>e;

                if (stopCondition(tEvent)) {
                    event = tEvent;
                    subscription.unsubscribe();
                }
            }
        });

        await poll(
            () => event,
            timeout,
            500,
            (e) => !!e
        );

        return event;
    }

    async waitForIdle(stream: EventStream, timeout: number = 25 * 1000): Promise<void> {
        let event: BaseEvent | undefined = { type: 0 };

        const subscription = stream.subscribe(
            (e: BaseEvent) => e.type !== EventType.BackgroundDiagnosticStatus && (event = e)
        );
        await poll(
            () => event,
            timeout,
            500,
            (e) => {
                if (e) {
                    // We're still getting real events, set the event to undefined so we can check if it changed in the next poll.
                    event = undefined;
                    return false;
                } else {
                    // The event is still undefined (set by the last poll) which means we haven't recieved any new events - we can exit here.
                    return true;
                }
            }
        );

        subscription.unsubscribe();
    }
}
