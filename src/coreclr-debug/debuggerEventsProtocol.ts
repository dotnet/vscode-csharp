/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This contains the definition of messages that netcoredbg can send back to a listener which registers itself via the 'debuggerEventsPipeName'
// property on a launch or attach request.
//
// All messages are sent as UTF-8 JSON text with a tailing '\n'
export namespace DebuggerEventsProtocol {
    export module EventType {
        // Indicates that the netcoredbg has received the attach or launch request and is starting up
        export const Starting = "starting";
        // Indicates that netcoredbg has successfully launched the specified process.
        // The ProcessLaunchedEvent interface details the event payload.
        export const ProcessLaunched = "processLaunched";
        // Debug session is ending
        export const DebuggingStopped = "debuggingStopped";
    }

    export interface DebuggerEvent {
        // Contains one of the 'DebuggerEventsProtocol.EventType' values
        eventType: string;
    }

    export interface ProcessLaunchedEvent extends DebuggerEvent {
        // Process id of the newly-launched target process
        targetProcessId: number;
    }

    // Decodes a packet received from the debugger into an event
    export function decodePacket(packet: Buffer): DebuggerEvent {
        // Verify the message ends in a newline
        if (packet[packet.length - 1] != 10 /*\n*/) {
            throw new Error("Unexpected message received from debugger.");
        }

        const message = packet.toString('utf-8', 0, packet.length - 1);
        return JSON.parse(message);
    }
}
