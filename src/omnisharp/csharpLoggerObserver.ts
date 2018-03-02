/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Logger } from "../logger";
import { Message, MessageType } from "./messageType";

export class csharpLoggerObserver {
    private logger;
    private dots: number;

    constructor(loggerCreator: () => Logger) {
        this.logger = loggerCreator();
    }

    public onNext(message: Message) {
        switch (message.type) {
            case MessageType.PackageInstallation:
                this.logger.append(`Installing ${message.packageInfo}...`);
                this.logger.appendLine();
                break;
            case MessageType.Platform:    
                this.logger.appendLine(`Platform: ${message.info.toString()}`);
                this.logger.appendLine();
                break;
            case MessageType.InstallationFailure:
                this.logger.appendLine(`Failed at stage: ${message.stage}`);
                this.logger.appendLine(message.message);
                this.logger.appendLine();
                break;
            case MessageType.InstallationFinished:
                this.logger.appendLine('Finished');
                this.logger.appendLine();
                break;
            case MessageType.InstallationProgress:
                this.logger.appendLine(message.message);
                this.logger.appendLine();
                break;
            case MessageType.DownloadStart:
                this.logger.append(message.message);
                this.dots = 0;
                break;    
            case MessageType.DownloadProgress:    
            let newDots = Math.ceil(message.downloadPercentage / 5);
            if (newDots > this.dots) {
                this.logger.append('.'.repeat(newDots - this.dots));
                this.dots = newDots;
            }
                break;
            case MessageType.DownloadEnd:
                this.logger.appendLine(message.message);  
            break;
        }
    }
}