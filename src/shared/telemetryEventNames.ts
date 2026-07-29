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
    CSharpLimitedActivation = 'CSharpLimitedActivation',

    // Events related to the roslyn language server.

    // Roslyn client has started initialization process.
    ClientInitialize = 'roslyn/clientInitialize',
    // Roslyn client has started the server initialization process.
    ClientServerStart = 'roslyn/clientServerInitialize',
    // Roslyn client has acquired the runtime needed to start the server.
    AcquiredRuntime = 'roslyn/acquiredRuntime',
    // Roslyn client has successfully started the server process.
    LaunchedServer = 'roslyn/launchedServer',
    // Roslyn client has connected to the server process named pipe.
    ClientConnected = 'roslyn/clientConnected',
    // Roslyn client and server have fully initialized via LSP.
    ClientServerReady = 'roslyn/clientServerReady',
    // Roslyn language server process crashed.
    ServerCrash = 'roslyn/serverCrash',

    // Events recording which entry point was used to change the project context.
    ProjectContextChangeFileExplorer = 'roslyn/projectContextChangeFileExplorer',
    ProjectContextChangeEditor = 'roslyn/projectContextChangeEditor',
    ProjectContextChangeCommand = 'roslyn/projectContextChangeCommand',

    // Copilot Chat survey lifecycle. Emitted with an `outcome` property: `shown` when the toast is
    // presented (emitted up front, since a non-modal toast may never be responded to), and
    // `accepted`/`dismissed` when the user makes an explicit choice.
    CopilotChatSurvey = 'roslyn/copilotChatSurvey',
    // The Copilot Chat survey qualified but failed to be presented due to an error.
    CopilotChatSurveyError = 'roslyn/copilotChatSurvey/error',
}
