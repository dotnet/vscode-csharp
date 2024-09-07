/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode } from '../../vscodeAdapter';
import showInformationMessage from '../../shared/observers/utils/showInformationMessage';
import { EventType } from '../../shared/eventType';
import { omnisharpOptions } from '../../shared/options';
import { l10n } from 'vscode';
import { BaseEvent } from '../../shared/loggingEvents';

export class InformationMessageObserver {
    constructor(private vscode: vscode) {}

    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.OmnisharpServerUnresolvedDependencies:
                this.handleOmnisharpServerUnresolvedDependencies();
                break;
        }
    };

    private async handleOmnisharpServerUnresolvedDependencies() {
        //to do: determine if we need the unresolved dependencies message
        if (!omnisharpOptions.suppressDotnetRestoreNotification) {
            const message = l10n.t(
                `There are unresolved dependencies. Please execute the restore command to continue.`
            );
            return showInformationMessage(this.vscode, message, {
                title: l10n.t('Restore'),
                command: 'dotnet.restore.all',
            });
        }
    }
}
