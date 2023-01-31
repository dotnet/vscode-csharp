/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { createTelemetryErrorEvent, createTelemetryEvent, HostEventStream } from './HostEventStream';
import { Trace } from './Trace';

export class TelemetryReporter {
    private readonly razorExtensionActivated = createTelemetryEvent('VSCode.Razor.RazorExtensionActivated');
    private readonly debugLanguageServerEvent = createTelemetryEvent('VSCode.Razor.DebugLanguageServer');
    private readonly workspaceContainsRazorEvent = createTelemetryEvent('VSCode.Razor.WorkspaceContainsRazor');
    private reportedWorkspaceContainsRazor = false;

    constructor(
        private readonly eventStream: HostEventStream) {
        // If this telemetry reporter is created it means the rest of the Razor extension world was created.
        this.eventStream.post(this.razorExtensionActivated);
    }

    public reportTraceLevel(trace: Trace) {
        const traceLevelEvent = createTelemetryEvent(
            'VSCode.Razor.TraceLevel',
            {
                trace: Trace[trace],
            });
        this.eventStream.post(traceLevelEvent);
    }

    public reportErrorOnServerStart(error: unknown) {
        let realError;
        if (error instanceof Error) {
            realError = error;
        } else {
            realError = Error(String(error));
        }

        this.reportError('VSCode.Razor.ErrorOnServerStart', realError);
    }

    public reportErrorOnActivation(error: unknown) {
        let realError;
        if (error instanceof Error) {
            realError = error;
        } else {
            realError = Error(String(error));
        }

        this.reportError('VSCode.Razor.ErrorOnActivation', realError);
    }

    public reportDebugLanguageServer() {
        this.eventStream.post(this.debugLanguageServerEvent);
    }

    public reportWorkspaceContainsRazor() {
        if (this.reportedWorkspaceContainsRazor) {
            return;
        }

        this.reportedWorkspaceContainsRazor = true;
        this.eventStream.post(this.workspaceContainsRazorEvent);
    }

    private reportError(eventName: string, error: Error) {
        const errorOnActivationEvent = createTelemetryErrorEvent(
            eventName,
            {
                error: JSON.stringify(error),
            },
            /*measures*/ undefined,
            /*errorProps*/['error']);

        this.eventStream.post(errorOnActivationEvent);
    }
}
