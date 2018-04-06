/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmnisharpServerOnServerError, BaseEvent, OmnisharpOnBeforeServerInstall, OmnisharpOnBeforeServerStart, OmnisharpServerOnStop, OmnisharpServerOnStart, DownloadStart, InstallationProgress, DownloadProgress } from "../omnisharp/loggingEvents";
import { BaseStatusBarItemObserver } from './BaseStatusBarItemObserver';

export class OmnisharpStatusBarObserver extends BaseStatusBarItemObserver {
    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case OmnisharpServerOnServerError.name:
                this.SetTextAndShowStatusBar('$(flame) Error starting OmniSharp', 'o.showOutput', '');
                break;
            case OmnisharpOnBeforeServerInstall.name:
                this.SetTextAndShowStatusBar('$(flame) Installing OmniSharp...', 'o.showOutput', '');
                break;
            case OmnisharpOnBeforeServerStart.name:
                this.SetTextAndShowStatusBar('$(flame) Starting...', 'o.showOutput', '');
                break;
            case OmnisharpServerOnStop.name:
                this.ResetAndHideStatusBar();
                break;
            case OmnisharpServerOnStart.name:
                this.SetTextAndShowStatusBar('$(flame) Running', 'o.showOutput', '');
                break;
            case DownloadStart.name:
                this.SetTextAndShowStatusBar("$(cloud-download) Downloading packages");
                this.SetToolTipAndShowStatusBar(`Downloading package '${(<DownloadStart>event).packageDescription}...' `);
                break;
            case InstallationProgress.name:
                this.SetTextAndShowStatusBar("$(desktop-download) Installing packages...");
                this.SetToolTipAndShowStatusBar(`Installing package '${(<InstallationProgress>event).packageDescription}'`);
                break;
            case DownloadProgress.name:
                let progressEvent = <DownloadProgress>event;
                this.SetToolTipAndShowStatusBar(`Downloading package '${progressEvent.packageDescription}'... ${progressEvent.downloadPercentage}%`);
                break;
        }
    }
}

