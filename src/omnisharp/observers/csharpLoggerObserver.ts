/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseLoggerObserver } from '../../shared/observers/baseLoggerObserver';
import { EventType } from '../../shared/eventType';
import { BaseEvent } from '../../shared/loggingEvents';
import { DocumentSynchronizationFailure } from '../omnisharpLoggingEvents';

export class CSharpLoggerObserver extends BaseLoggerObserver {
    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.ProjectJsonDeprecatedWarning:
                this.logger.appendLine(
                    "Warning: project.json is no longer a supported project format for .NET Core applications. Update to the latest version of .NET Core (https://aka.ms/netcoredownload) and use 'dotnet migrate' to upgrade your project (see https://aka.ms/netcoremigrate for details)."
                );
                break;
            case EventType.DocumentSynchronizationFailure:
                this.handleDocumentSynchronizationFailure(<DocumentSynchronizationFailure>event);
                break;
            case EventType.LatestBuildDownloadStart:
                this.logger.appendLine('Getting latest OmniSharp version information');
                break;
        }
    };

    private handleDocumentSynchronizationFailure(event: DocumentSynchronizationFailure) {
        this.logger.appendLine(`Failed to synchronize document '${event.documentPath}': ${event.errorMessage}`);
    }
}
