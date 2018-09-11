/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getFakeVsCode } from "../testAssets/Fakes";
import fileIssue from "../../../src/features/fileIssue";
import { EventStream } from "../../../src/EventStream";
import TestEventBus from "../testAssets/TestEventBus";
import { expect } from "chai";
import { ReportIssue } from "../../../src/omnisharp/loggingEvents";
import { vscode } from "../../../src/vscodeAdapter";

suite("File Issue", () => {
    const vscodeVersion = "myVersion";
    const csharpExtVersion = "csharpExtVersion";
    const monoInfo = "myMonoInfo";
    const dotnetInfo = "myDotnetInfo";
    const isValidForMono = true;
    let vscode: vscode;
    const extension1 = {
        packageJSON: {
            name: "name1",
            publisher: "publisher1",
            version: "version1",
            isBuiltin: true
        },
        id: "id1"
    };

    const extension2 = {
        packageJSON: {
            name: "name2",
            publisher: "publisher2",
            version: "version2",
            isBuiltin: false
        },
        id:"id2"
    };

    let eventStream: EventStream;
    let eventBus: TestEventBus;
    let execCommands: Array<string>;
    let execChildProcess = (command: string, workingDir?: string) => {
        execCommands.push(command);
        if (command == "dotnet --info") {
            return Promise.resolve(dotnetInfo);
        }
        else if (command == "mono --version") {
            return Promise.resolve(monoInfo);
        }
        else {
            return Promise.resolve("randomValue");
        }
    };

    setup(() => {
        vscode = getFakeVsCode();
        vscode.extensions.getExtension = () => {
            return {
                packageJSON: {
                    version: csharpExtVersion
                },
                id: ""
            };
        };
        vscode.version = vscodeVersion;
        vscode.extensions.all = [extension1, extension2];
        eventStream = new EventStream();
        eventBus = new TestEventBus(eventStream);
        execCommands = [];
    });

    test(`${ReportIssue.name} event is created`, async () => {
        await fileIssue(vscode, eventStream, execChildProcess, isValidForMono);
        let events = eventBus.getEvents();
        expect(events).to.have.length(1);
        expect(events[0].constructor.name).to.be.equal(`${ReportIssue.name}`);
    });

    test("${ReportIssue.name} event is created with the omnisharp-vscode github repo issues url", async () => {
        await fileIssue(vscode, eventStream, execChildProcess, false);
        expect(execCommands).to.not.contain("mono --version");
        let event = <ReportIssue>eventBus.getEvents()[0];
        expect(event.url).to.be.equal("https://github.com/OmniSharp/omnisharp-vscode/issues/new");
    });

    test("The body contains the vscode version", async () => {
        await fileIssue(vscode, eventStream, execChildProcess, isValidForMono);
        let event = <ReportIssue>eventBus.getEvents()[0];
        expect(event.body).to.contain(encodeURIComponent(`VSCode version: ${vscodeVersion}`));
    });

    test("The body contains the csharp extension version", async () => {
        await fileIssue(vscode, eventStream, execChildProcess, isValidForMono);
        let event = <ReportIssue>eventBus.getEvents()[0];
        expect(event.body).to.contain(encodeURIComponent(`C# Extension: ${csharpExtVersion}`));
    });

    test("dotnet info is obtained and put into the body", async() => {
        await fileIssue(vscode, eventStream, execChildProcess, isValidForMono);
        expect(execCommands).to.contain("dotnet --info");
        let event = <ReportIssue>eventBus.getEvents()[0];
        expect(event.body).to.contain(dotnetInfo);
    });

    test("mono information is obtained when it is a valid mono platform", async () => {
        await fileIssue(vscode, eventStream, execChildProcess, isValidForMono);
        expect(execCommands).to.contain("mono --version");
        let event = <ReportIssue>eventBus.getEvents()[0];
        expect(event.body).to.contain(monoInfo);
    });

    test("mono information is not obtained when it is not a valid mono platform", async () => {
        await fileIssue(vscode, eventStream, execChildProcess, false);
        expect(execCommands).to.not.contain("mono --version");
        let event = <ReportIssue>eventBus.getEvents()[0];
        expect(event.body).to.not.contain(monoInfo);
    });

    test("The body contains all the name, publisher and version for the extensions that are not builtin", async () => {
        await fileIssue(vscode, eventStream, execChildProcess, isValidForMono);
        let event = <ReportIssue>eventBus.getEvents()[0];
        expect(event.body).to.contain(extension2.packageJSON.name);
        expect(event.body).to.contain(extension2.packageJSON.publisher);
        expect(event.body).to.contain(extension2.packageJSON.version);
        expect(event.body).to.not.contain(extension1.packageJSON.name);
        expect(event.body).to.not.contain(extension1.packageJSON.publisher);
        expect(event.body).to.not.contain(extension1.packageJSON.version);
    });

    test("issuesUrl is put into the event url", async() => {
        await fileIssue(vscode, eventStream, execChildProcess, isValidForMono);
        let event = <ReportIssue>eventBus.getEvents()[0];
        expect(event.url).to.be.equal("https://github.com/OmniSharp/omnisharp-vscode/issues/new");
    });
});