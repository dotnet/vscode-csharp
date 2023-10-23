/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll } from '@jest/globals';
import * as vscode from 'vscode';
import * as path from 'path';
import { activateCSharpExtension, describeIfSlnWithCsProj } from './integrationHelpers';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';
import { EventStream } from '../../src/eventStream';
import { EventType } from '../../src/omnisharp/eventType';
import { OmnisharpRequestMessage } from '../../src/omnisharp/loggingEvents';
import { V2 } from '../../src/omnisharp/protocol';
import { isNotNull } from '../testUtil';

// These tests only run on the slnWithCsproj solution
describeIfSlnWithCsProj(`DotnetTest: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;
    let eventStream: EventStream;

    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();

        eventStream = activation.eventStream;

        const fileName = 'UnitTest1.cs';
        const projectDirectory = testAssetWorkspace.projects[2].projectDirectoryPath;
        const filePath = path.join(projectDirectory, fileName);
        fileUri = vscode.Uri.file(filePath);

        await vscode.commands.executeCommand('vscode.open', fileUri);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Undefined runsettings path is unchanged', async function () {
        const omnisharpConfig = vscode.workspace.getConfiguration('dotnet');
        await omnisharpConfig.update('unitTests.runSettingsPath', undefined);

        const eventWaiter = testAssetWorkspace.waitForEvent<OmnisharpRequestMessage>(
            eventStream,
            EventType.OmnisharpRequestMessage,
            (e) => e.request.command === V2.Requests.RunTestsInContext,
            /* timeout */ 10 * 1000
        );

        await vscode.commands.executeCommand('dotnet.test.runTestsInContext');

        const event = await eventWaiter;
        const runTestsRequest = <V2.RunTestsInContextRequest>event!.request.data;

        expect(runTestsRequest.RunSettings).toBe(undefined);
    });

    test('Absolute runsettings path is unchanged', async function () {
        const relativeRunSettingsPath = `.\\settings\\TestSettings.runsettings`.replace('\\', path.sep);
        const absoluteRunSettingsPath = path.join(process.cwd(), relativeRunSettingsPath);

        const omnisharpConfig = vscode.workspace.getConfiguration('dotnet');
        await omnisharpConfig.update('unitTests.runSettingsPath', absoluteRunSettingsPath);

        const eventWaiter = testAssetWorkspace.waitForEvent<OmnisharpRequestMessage>(
            eventStream,
            EventType.OmnisharpRequestMessage,
            (e) => e.request.command === V2.Requests.RunTestsInContext,
            /* timeout */ 10 * 1000
        );

        await vscode.commands.executeCommand('dotnet.test.runTestsInContext');

        const event = await eventWaiter;
        const runTestsRequest = <V2.RunTestsInContextRequest>event!.request.data;

        expect(runTestsRequest.RunSettings).toEqual(absoluteRunSettingsPath);
    });

    test('Relative runsettings path is made absolute', async function () {
        const endingPath = 'settings\\TestSettings.runsettings'.replace('\\', path.sep);
        const relativeRunSettingPath = `.\\${endingPath}`.replace('\\', path.sep);

        const omnisharpConfig = vscode.workspace.getConfiguration('dotnet');
        await omnisharpConfig.update('unitTests.runSettingsPath', relativeRunSettingPath);

        const eventWaiter = testAssetWorkspace.waitForEvent<OmnisharpRequestMessage>(
            eventStream,
            EventType.OmnisharpRequestMessage,
            (e) => e.request.command === V2.Requests.RunTestsInContext,
            /* timeout */ 10 * 1000
        );

        await vscode.commands.executeCommand('dotnet.test.runTestsInContext');

        const event = await eventWaiter;
        const runTestsRequest = <V2.RunTestsInContextRequest>event!.request.data;

        isNotNull(runTestsRequest.RunSettings);
        expect(runTestsRequest.RunSettings!.endsWith(endingPath)).toBe(true);
        expect(path.isAbsolute(runTestsRequest.RunSettings!)).toBe(true);
    });
});
