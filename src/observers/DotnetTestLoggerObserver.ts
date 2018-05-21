/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEvent, DotnetTestRunStart, DotnetTestMessage, ReportDotnetTestResults, DotnetTestDebugStart } from "../omnisharp/loggingEvents";
import { BaseLoggerObserver } from "./BaseLoggerObserver";
import * as protocol from '../omnisharp/protocol';

export default class DotnetTestLoggerObserver extends BaseLoggerObserver {

    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case DotnetTestRunStart.name:
                this.handleDotnetTestRunStart(<DotnetTestRunStart>event);
                break;
            case DotnetTestMessage.name:
                this.logger.appendLine((<DotnetTestMessage>event).message);
                break;
            case ReportDotnetTestResults.name:
                this.handleReportDotnetTestResults(<ReportDotnetTestResults>event);
                break;
            case DotnetTestDebugStart.name:
                this.handleDotnetTestDebugStart(<DotnetTestDebugStart>event);
                break;
        }
    }

    private handleDotnetTestDebugStart(event: DotnetTestDebugStart) {
        this.logger.appendLine(`Debugging method ${event.testMethod}...`);
        this.logger.appendLine('');
    }

    private handleDotnetTestRunStart(event: DotnetTestRunStart): any {
        this.logger.appendLine(`Running test ${event.testMethod}...`);
        this.logger.appendLine('');
    }

    private handleReportDotnetTestResults(event: ReportDotnetTestResults) {
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