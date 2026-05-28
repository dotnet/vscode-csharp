/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import TelemetryReporter from '@vscode/extension-telemetry';
import {
    getExperimentationServiceAsync,
    IExperimentationService,
    IExperimentationTelemetry,
    TargetPopulation,
} from 'vscode-tas-client';
import * as vscode from 'vscode';

export class TasTelemetryReporter extends TelemetryReporter implements IExperimentationTelemetry {
    private readonly _sharedProperties: { [key: string]: string } = {};

    public setSharedProperty(name: string, value: string): void {
        this._sharedProperties[name] = value;
    }

    public postEvent(eventName: string, props: Map<string, string>): void {
        this.sendTelemetryEvent(eventName, Object.fromEntries(props));
    }

    public override sendTelemetryEvent(
        eventName: string,
        properties?: { [key: string]: string },
        measurements?: { [key: string]: number }
    ): void {
        super.sendTelemetryEvent(eventName, this.withSharedProperties(properties), measurements);
    }

    public override sendTelemetryErrorEvent(
        eventName: string,
        properties?: { [key: string]: string },
        measurements?: { [key: string]: number },
        _errorProps?: string[]
    ): void {
        super.sendTelemetryErrorEvent(eventName, this.withSharedProperties(properties), measurements);
    }

    private withSharedProperties(properties?: { [key: string]: string }): { [key: string]: string } | undefined {
        if (Object.keys(this._sharedProperties).length === 0) {
            return properties;
        }

        if (!properties) {
            return { ...this._sharedProperties };
        }

        return {
            ...this._sharedProperties,
            ...properties,
        };
    }
}

export async function initializeTasExperimentationService(
    context: vscode.ExtensionContext,
    reporter: TasTelemetryReporter
): Promise<IExperimentationService> {
    const targetPopulation = getTargetPopulation();

    const service = await getExperimentationServiceAsync(
        context.extension.packageJSON.name,
        context.extension.packageJSON.version,
        targetPopulation,
        reporter,
        context.globalState
    );

    return service;
}

function getTargetPopulation(): TargetPopulation {
    switch (vscode.env.uriScheme) {
        case 'vscode':
            return TargetPopulation.Public;

        case 'vscode-insiders':
            return TargetPopulation.Insiders;

        case 'vscode-exploration':
            return TargetPopulation.Internal;

        case 'code-oss':
            return TargetPopulation.Team;

        default:
            return TargetPopulation.Public;
    }
}
