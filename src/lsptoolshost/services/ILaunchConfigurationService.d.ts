/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { IDisposable, IObserver } from "@microsoft/servicehub-framework";

export interface ILaunchConfigurationService
{
    subscribe(observer: IObserver<LaunchableProjectInfo[]>): Promise<IDisposable>;
    setActiveLaunchConfiguration(projectPath: string, launchConfigurationId: string, cancellationToken: vscode.CancellationToken): Promise<boolean>;
    queryLaunchTargets(projectPath: string, options: LaunchOptions, cancellationToken: vscode.CancellationToken): Promise<LaunchTarget[]>;
}

export interface LaunchableProjectInfo
{
    displayName: string;
    fullPath: string;
    launchConfigurations: LaunchConfigurationInfo[];
    activeLaunchConfigurationId: string;
}

export interface LaunchConfigurationInfo
{
    displayName: string;
    id: string;
}

export interface LaunchOptions
{
    noDebug: boolean;
    preferSSL: boolean;
}

export interface LaunchTarget
{
    launchOptions: LaunchOptions;
    debugEngines: string[];
}

export interface ExeLaunchTarget extends LaunchTarget
{
    executable: string;
    directory: string;
    commandLineArguments: string | undefined;
    environmentVariables: Map<string, string>[];
    isConsoleApp: boolean;
    isUsingSSL: boolean;
}

export module ExeLaunchTarget {
    export function is(value: LaunchTarget): value is ExeLaunchTarget {
        return 'executable' in value &&
            'directory' in value &&
            'commandLineArguments' in value &&
            'environmentVariables' in value &&
            'isConsoleApp' in value &&
            'isUsingSSL' in value;
    }
}

export interface BrowserLaunchTarget extends LaunchTarget
{
    url: string;
}

export module BrowserLaunchTarget {
    export function is(value: LaunchTarget): value is BrowserLaunchTarget {
        return 'url' in value;
    }
}

export interface CustomLaunchTarget extends LaunchTarget
{
    options: Map<string, string>[];
}

export module CustomLaunchTarget {
    export function is(value: LaunchTarget): value is CustomLaunchTarget {
        return 'options' in value;
    }
}