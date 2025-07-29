/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Defines all telemetry event names to ensure we do not have overlapping events.
 */
export enum TelemetryEventNames {
    // Common extension events
    CSharpActivated = 'CSharpActivated',

    // Events related to the roslyn language server.
    ClientInitialize = 'roslyn/clientInitialize',
    ClientServerStart = 'roslyn/clientServerInitialize',
    AcquiredRuntime = 'roslyn/acquiredRuntime',
    LaunchedServer = 'roslyn/launchedServer',
    ClientConnected = 'roslyn/clientConnected',
}
