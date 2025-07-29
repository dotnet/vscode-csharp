/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll } from '@jest/globals';
import * as vscode from 'vscode';
import * as path from 'path';
import { activateCSharpExtension, describeIfNotRazorOrGenerator } from './integrationHelpers';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';
import { poll, assertWithPoll } from './poll';
import { EventStream } from '../../../src/eventStream';
import { EventType } from '../../../src/shared/eventType';
import { BaseEvent } from '../../../src/shared/loggingEvents';
import { OmnisharpBackgroundDiagnosticStatus } from '../../../src/omnisharp/omnisharpLoggingEvents';
import { BackgroundDiagnosticStatus } from '../../../src/omnisharp/protocol';

function listenEvents<T extends BaseEvent>(stream: EventStream, type: EventType): T[] {
    const results: T[] = [];

    stream.subscribe((event: BaseEvent) => {
        if (event.type === type) {
            results.push(<T>event);
        }
    });

    return results;
}

describeIfNotRazorOrGenerator(`ReAnalyze: ${testAssetWorkspace.description}`, function () {
    let interfaceUri: vscode.Uri;
    let interfaceImplUri: vscode.Uri;
    let eventStream: EventStream;

    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();

        eventStream = activation.eventStream;

        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        interfaceUri = vscode.Uri.file(path.join(projectDirectory, 'ISomeInterface.cs'));
        interfaceImplUri = vscode.Uri.file(path.join(projectDirectory, 'SomeInterfaceImpl.cs'));

        await vscode.commands.executeCommand('vscode.open', interfaceImplUri);
        await vscode.commands.executeCommand('vscode.open', interfaceUri);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('When interface is manually renamed, then return correct analysis after re-analysis of project', async function () {
        const diagnosticStatusEvents = listenEvents<OmnisharpBackgroundDiagnosticStatus>(
            eventStream,
            EventType.BackgroundDiagnosticStatus
        );

        await vscode.commands.executeCommand('vscode.open', interfaceUri);

        const editor = vscode.window.activeTextEditor;

        await editor!.edit((editorBuilder) =>
            editorBuilder.replace(new vscode.Range(2, 0, 2, 50), 'public interface ISomeInterfaceRenamedNow')
        );

        await vscode.commands.executeCommand('o.reanalyze.currentProject', interfaceImplUri);

        await poll(
            () => diagnosticStatusEvents,
            15 * 1000,
            500,
            (r) => r.find((x) => x.message.Status === BackgroundDiagnosticStatus.Finished) !== undefined
        );

        await assertWithPoll(
            () => vscode.languages.getDiagnostics(interfaceImplUri),
            15 * 1000,
            500,
            (res) => expect(res.find((x) => x.message.includes('CS0246')))
        );
    });

    test('When re-analyze of project is executed then eventually get notified about them.', async function () {
        const diagnosticStatusEvents = listenEvents<OmnisharpBackgroundDiagnosticStatus>(
            eventStream,
            EventType.BackgroundDiagnosticStatus
        );

        await vscode.commands.executeCommand('o.reanalyze.currentProject', interfaceImplUri);

        await poll(
            () => diagnosticStatusEvents,
            15 * 1000,
            500,
            (r) => r.find((x) => x.message.Status !== BackgroundDiagnosticStatus.Finished) != undefined
        );
        await poll(
            () => diagnosticStatusEvents,
            15 * 1000,
            500,
            (r) => r.find((x) => x.message.Status === BackgroundDiagnosticStatus.Finished) != undefined
        );
    });

    test('When re-analyze of all projects is executed then eventually get notified about them.', async function () {
        const diagnosticStatusEvents = listenEvents<OmnisharpBackgroundDiagnosticStatus>(
            eventStream,
            EventType.BackgroundDiagnosticStatus
        );

        await vscode.commands.executeCommand('o.reanalyze.allProjects', interfaceImplUri);

        await poll(
            () => diagnosticStatusEvents,
            15 * 1000,
            500,
            (r) => r.find((x) => x.message.Status !== BackgroundDiagnosticStatus.Finished) != undefined
        );
        await poll(
            () => diagnosticStatusEvents,
            15 * 1000,
            500,
            (r) => r.find((x) => x.message.Status === BackgroundDiagnosticStatus.Finished) != undefined
        );
    });
});
