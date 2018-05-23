/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEvent, DotNetTestRunStart, DotNetTestMessage, ReportDotNetTestResults, DotNetTestDebugStart, DotNetTestDebugWarning, DotNetTestDebugProcessStart, DotNetTestDebugComplete } from "../omnisharp/loggingEvents";
import { BaseLoggerObserver } from "./BaseLoggerObserver";
import * as protocol from '../omnisharp/protocol';

export default class DotNetTestLoggerObserver extends BaseLoggerObserver {

    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case DotNetTestRunStart.name:
                this.handleDotnetTestRunStart(<DotNetTestRunStart>event);
                break;
            case DotNetTestMessage.name:
                this.logger.appendLine((<DotNetTestMessage>event).message);
                break;
            case ReportDotNetTestResults.name:
                this.handleReportDotnetTestResults(<ReportDotNetTestResults>event);
                break;
            case DotNetTestDebugStart.name:
                this.handleDotnetTestDebugStart(<DotNetTestDebugStart>event);
                break;
            case DotNetTestDebugWarning.name:
                this.handleDotNetTestDebugWarning(<DotNetTestDebugWarning>event);
                break;
            case DotNetTestDebugProcessStart.name:
                this.handleDotNetTestDebugProcessStart(<DotNetTestDebugProcessStart>event);
                break;
            case DotNetTestDebugComplete.name:
                this.logger.appendLine("Debugging complete.\n");
                break;
        }
    }

    private handleDotNetTestDebugWarning(event: DotNetTestDebugWarning) {
        this.logger.appendLine(`Warning: ${event.message}`);
    }

    private handleDotnetTestDebugStart(event: DotNetTestDebugStart) {
        this.logger.appendLine(`Debugging method ${event.testMethod}...`);
        this.logger.appendLine('');
    }

    private handleDotnetTestRunStart(event: DotNetTestRunStart): any {
        this.logger.appendLine(`Running test ${event.testMethod}...`);
        this.logger.appendLine('');
    }

    private handleDotNetTestDebugProcessStart(event: DotNetTestDebugProcessStart) {
        this.logger.appendLine(`Started debugging process #${event.targetProcessId}.`);
    }

    private handleReportDotnetTestResults(event: ReportDotNetTestResults) {
        const results = event.results;
        const totalTests = results.length;

        let totalPassed = 0, totalFailed = 0, totalSkipped = 0;
        for (let result of results) {
            this.logger.appendLine(`${result.MethodName}: ${result.Outcome}`);
            switch (result.Outcome) {
                case protocol.V2.TestOutcomes.Failed:
                    totalFailed += 1;
                    break;
                case protocol.V2.TestOutcomes.Passed:
                    totalPassed += 1;
                    break;
                case protocol.V2.TestOutcomes.Skipped:
                    totalSkipped += 1;
                    break;
            }
        }

        this.logger.appendLine('');
        this.logger.appendLine(`Total tests: ${totalTests}. Passed: ${totalPassed}. Failed: ${totalFailed}. Skipped: ${totalSkipped}`);
        this.logger.appendLine('');
    }
}