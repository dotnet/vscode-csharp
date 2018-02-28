/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Logger } from "../logger";
import { Message, MessageType } from "./messageType";

export class csharpLoggerObserver {
    private logger;

    constructor(loggerCreator: () => Logger) {
        this.logger = loggerCreator();
    }

    public onNext(message: Message) {
        switch (message.type) {
            case MessageType.OmnisharpInstallation:
                this.logger.append('Installing Omnisharp Packages...');
                this.logger.appendLine();
                break;
            case MessageType.Platform:
                this.logger.appendLine(`Platform: ${message.info.toString()}`);
                this.logger.appendLine();
                break;
            case MessageType.InstallationFailure:
                this.logger.appendLine();
                this.logger.appendLine(`Failed at stage: ${message.stage}`);
                this.logger.appendLine(message.message);
                this.logger.appendLine();
                break;
            case MessageType.InstallationFinished:
                this.logger.appendLine();
                this.logger.appendLine('Finished');
                this.logger.appendLine();
                break;
            case MessageType.InstallationProgress:
                this.logger.appendLine(message.message);
                this.logger.appendLine();
                break;
        }
    }
}