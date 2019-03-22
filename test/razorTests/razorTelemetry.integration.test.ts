/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as vscode from 'vscode';
import testAssetWorkspace from '../integrationTests/testAssets/testAssetWorkspace';
import { activateCSharpExtension } from '../integrationTests/integrationHelpers';
import { htmlLanguageFeaturesExtensionReady } from "./testUtils";
import { EventStream } from '../../src/EventStream';
import { EventType } from '../../src/omnisharp/EventType';
import { TelemetryEvent } from 'microsoft.aspnetcore.razor.vscode/dist/HostEventStream';
import { Subscription } from 'rxjs';

let eventStream: EventStream;
let subscription: Subscription;

suite(`Razor Telemetry ${testAssetWorkspace.description}`, () => {
    suiteSetup(async function () {
        eventStream = (await activateCSharpExtension()).eventStream;
        await htmlLanguageFeaturesExtensionReady();
        await testAssetWorkspace.restore();
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();    
    });

    teardown(() => {
        if (subscription) {
            subscription.unsubscribe();
       } 
    });

    test("The DocumentOpened telemevent is received when a document is opened", async () => {
        let telemetryEventResolver: (value?: any) => void;
        // tslint:disable-next-line:promise-must-complete
        const extensionActivated = new Promise(resolve => {
            telemetryEventResolver = resolve;
        });
        
        subscription = eventStream.subscribe(event =>{
            if (event.type == EventType.TelemetryEvent) {
                let possibleRazorEvent = <TelemetryEvent>event;
                if (possibleRazorEvent.eventName == "VSCode.Razor.DocumentOpened") {
                    telemetryEventResolver();
                }
            }
        });
        const filePath = path.join(testAssetWorkspace.projects[0].projectDirectoryPath, 'Pages', 'Index.cshtml');
        await vscode.workspace.openTextDocument(filePath);
        await extensionActivated;
    });
});
