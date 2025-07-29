/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEvent, DownloadProgress, DownloadStart, InstallationStart } from '../../shared/loggingEvents';
import { OmnisharpServerOnStdErr } from '../omnisharpLoggingEvents';
import { BaseStatusBarItemObserver } from './baseStatusBarItemObserver';
import { EventType } from '../../shared/eventType';

export enum StatusBarColors {
    Red = 'rgb(218,0,0)',
    Green = 'rgb(0,218,0)',
    Yellow = 'rgb(218,218,0)',
}

export class OmnisharpStatusBarObserver extends BaseStatusBarItemObserver {
    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.OmnisharpServerOnServerError:
                this.SetAndShowStatusBar('$(flame)', 'o.showOutput', StatusBarColors.Red, 'Error starting OmniSharp');
                break;
            case EventType.OmnisharpServerOnStdErr:
                this.SetAndShowStatusBar(
                    '$(flame)',
                    'o.showOutput',
                    StatusBarColors.Red,
                    `OmniSharp process errored:${(<OmnisharpServerOnStdErr>event).message}`
                );
                break;
            case EventType.OmnisharpOnBeforeServerInstall:
                this.SetAndShowStatusBar('$(flame) Installing OmniSharp...', 'o.showOutput');
                break;
            case EventType.OmnisharpOnBeforeServerStart:
                this.SetAndShowStatusBar(
                    '$(flame)',
                    'o.showOutput',
                    StatusBarColors.Yellow,
                    'Starting OmniSharp server'
                );
                break;
            case EventType.OmnisharpServerOnStop:
                this.ResetAndHideStatusBar();
                break;
            case EventType.OmnisharpServerOnStart:
                this.SetAndShowStatusBar('$(flame)', 'o.showOutput', undefined, 'OmniSharp server is running');
                break;
            case EventType.DownloadStart:
                this.SetAndShowStatusBar(
                    '$(cloud-download) Downloading packages',
                    '',
                    '',
                    `Downloading package '${(<DownloadStart>event).packageDescription}...' `
                );
                break;
            case EventType.InstallationStart:
                this.SetAndShowStatusBar(
                    '$(desktop-download) Installing packages...',
                    '',
                    '',
                    `Installing package '${(<InstallationStart>event).packageDescription}'`
                );
                break;
            case EventType.InstallationSuccess:
                this.ResetAndHideStatusBar();
                break;
            case EventType.DownloadProgress: {
                const progressEvent = <DownloadProgress>event;
                this.SetAndShowStatusBar(
                    '$(cloud-download) Downloading packages',
                    '',
                    '',
                    `Downloading package '${progressEvent.packageDescription}'... ${progressEvent.downloadPercentage}%`
                );
                break;
            }
        }
    };
}
