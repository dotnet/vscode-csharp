/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

import { should, expect } from 'chai';
import { activateCSharpExtension, isSlnWithCsproj } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { EventStream } from '../../src/EventStream';
import { EventType } from '../../src/omnisharp/EventType';
import { OmnisharpRequestMessage } from '../../src/omnisharp/loggingEvents';
import { V2 } from '../../src/omnisharp/protocol';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`DotnetTest: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;
    let eventStream: EventStream;

    suiteSetup(async function () {
        should();

        // These tests only run on the slnWithCsproj solution
        if (!isSlnWithCsproj(vscode.workspace)) {
            this.skip();
        }
        else {
            const activation = await activateCSharpExtension();
            await testAssetWorkspace.restore();

            eventStream = activation.eventStream;

            let fileName = 'UnitTest1.cs';
            let projectDirectory = testAssetWorkspace.projects[2].projectDirectoryPath;
            let filePath = path.join(projectDirectory, fileName);
            fileUri = vscode.Uri.file(filePath);

            await vscode.commands.executeCommand("vscode.open", fileUri);

            await testAssetWorkspace.waitForIdle(activation.eventStream);
        }
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Undefined runsettings path is unchanged", async function () {
        const omnisharpConfig = vscode.workspace.getConfiguration('omnisharp');
        await omnisharpConfig.update('testRunSettings', undefined);

        const eventWaiter = testAssetWorkspace.waitForEvent<OmnisharpRequestMessage>(eventStream, EventType.OmnisharpRequestMessage, e => e.request.command === V2.Requests.RunTestsInContext, /* timeout */ 10 * 1000);

        await vscode.commands.executeCommand('dotnet.test.runTestsInContext');

        const event = await eventWaiter;
        const runTestsRequest = <V2.RunTestsInContextRequest>event.request.data;

        expect(runTestsRequest.RunSettings).to.be.undefined;
    });

    test("Absolute runsettings path is unchanged", async function () {
        const relativeRunSettingsPath = `.\\settings\\TestSettings.runsettings`.replace("\\", path.sep);
        const absoluteRunSettingsPath = path.join(process.cwd(), relativeRunSettingsPath);

        const omnisharpConfig = vscode.workspace.getConfiguration('omnisharp');
        await omnisharpConfig.update('testRunSettings', absoluteRunSettingsPath);

        const eventWaiter = testAssetWorkspace.waitForEvent<OmnisharpRequestMessage>(eventStream, EventType.OmnisharpRequestMessage, e => e.request.command === V2.Requests.RunTestsInContext, /* timeout */ 10 * 1000);

        await vscode.commands.executeCommand('dotnet.test.runTestsInContext');

        const event = await eventWaiter;
        const runTestsRequest = <V2.RunTestsInContextRequest>event.request.data;

        expect(runTestsRequest.RunSettings).to.be.equal(absoluteRunSettingsPath);
    });

    test("Relative runsettings path is made absolute", async function () {
        const endingPath = 'settings\\TestSettings.runsettings'.replace("\\", path.sep);
        const relativeRunSettingPath = `.\\${endingPath}`.replace("\\", path.sep);

        const omnisharpConfig = vscode.workspace.getConfiguration('omnisharp');
        await omnisharpConfig.update('testRunSettings', relativeRunSettingPath);

        const eventWaiter = testAssetWorkspace.waitForEvent<OmnisharpRequestMessage>(eventStream, EventType.OmnisharpRequestMessage, e => e.request.command === V2.Requests.RunTestsInContext, /* timeout */ 10 * 1000);

        await vscode.commands.executeCommand('dotnet.test.runTestsInContext');

        const event = await eventWaiter;
        const runTestsRequest = <V2.RunTestsInContextRequest>event.request.data;

        expect(runTestsRequest.RunSettings).to.be.not.null;
        expect(runTestsRequest.RunSettings.endsWith(endingPath), "Path includes relative path").to.be.true;
        expect(path.isAbsolute(runTestsRequest.RunSettings), "Path is absolute").to.be.true;
    });
});

