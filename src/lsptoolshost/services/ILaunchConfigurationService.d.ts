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
    arguments: string | undefined;
    environmentVariables: Map<string, string>[];
    isConsoleApp: boolean;
    isUsingSSL: boolean;
}

export interface BrowserLaunchTarget extends LaunchTarget
{
    url: string;
}

export interface CustomLaunchTarget extends LaunchTarget
{
    options: Map<string, string>[];
}