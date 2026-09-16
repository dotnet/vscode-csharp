/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import psList from 'ps-list';
import { DebugSession } from 'vscode';
import { LogOutputChannel } from 'vscode';
import { JS_DEBUG_NAME, SERVER_APP_NAME } from './constants';

export const isValidEvent = (name: string) => {
    // The name can be of the form: `Debug Blazor Web Assembly in Browser: https://localhost:7291`
    // hence we have to examine what the name **startsWith**
    return name.startsWith(JS_DEBUG_NAME) || name === SERVER_APP_NAME;
};

const killProcess = (targetPid: number | undefined, logger: LogOutputChannel) => {
    // If no PID was provided, then exit early.
    if (!targetPid) {
        return;
    }

    try {
        logger.trace(`[DEBUGGER] Terminating debugging session with PID ${targetPid}...`);
        process.kill(targetPid);
    } catch (error) {
        logger.error(`[DEBUGGER] Error terminating debug processes with PID ${targetPid}: `, error as Error);
    }
};

export async function onDidTerminateDebugSession(
    event: DebugSession,
    logger: LogOutputChannel,
    target: string | number | undefined
) {
    if (!target) {
        return;
    }

    if (typeof target === 'number') {
        terminateByPid(event, logger, target);
    } else {
        await terminateByProcessName(event, logger, target);
    }
}

function terminateByPid(event: DebugSession, logger: LogOutputChannel, targetPid: number | undefined) {
    // Ignore debug sessions that are not applicable to us
    if (!isValidEvent(event.name)) {
        return;
    }

    killProcess(targetPid, logger);
}

async function terminateByProcessName(event: DebugSession, logger: LogOutputChannel, targetProcess: string) {
    // Ignore debug sessions that are not applicable to us
    if (!isValidEvent(event.name)) {
        return;
    }

    let processes: psList.ProcessDescriptor[] = [];
    try {
        processes = await psList();
    } catch (error) {
        logger.error(`Error retrieving processes to clean-up: `, error as Error);
    }

    const devserver = processes.find(
        (process: psList.ProcessDescriptor) =>
            !!(process && process.cmd && process.cmd.toLowerCase().match(targetProcess))
    );

    if (devserver) {
        killProcess(devserver.pid, logger);
    }
}
