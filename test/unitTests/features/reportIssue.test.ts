/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getFakeVsCode } from "../testAssets/Fakes";
import reportIssue from "../../../src/features/reportIssue";
import { EventStream } from "../../../src/EventStream";
import TestEventBus from "../testAssets/TestEventBus";
import { expect } from "chai";
import { OpenURL } from "../../../src/omnisharp/loggingEvents";
import { vscode } from "../../../src/vscodeAdapter";
import { IMonoResolver } from "../../../src/omnisharp/constants/IMonoResolver";
import { Options } from "../../../src/omnisharp/options";
import { MonoInformation } from "../../../src/omnisharp/constants/MonoInformation";

suite(`${reportIssue.name}`, () => {
    const vscodeVersion = "myVersion";
    const csharpExtVersion = "csharpExtVersion";
    const monoInfo: MonoInformation = {
        version: "someMonoVersion",
        path: "somePath",
        env: undefined
    };
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
        id: "id2"
    };

    let shouldUseGlobalMonoCalled: boolean;
    let monoResolver: IMonoResolver;
    
    let eventStream: EventStream;
    let eventBus: TestEventBus;
    let execCommands: Array<string>;
    let execChildProcess = (command: string, workingDir?: string) => {
        execCommands.push(command);
        if (command == "dotnet --info") {
            return Promise.resolve(dotnetInfo);
        }
        else {
            return Promise.resolve("randomValue");
        }
    };
    let options: Options;

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
        shouldUseGlobalMonoCalled = false;
        monoResolver = {
            getGlobalMonoInfo: () => {
                shouldUseGlobalMonoCalled = true;
                return Promise.resolve(monoInfo);
            }
        };
    });

    test(`${OpenURL.name} event is created`, async () => {
        await reportIssue(vscode, eventStream, execChildProcess, isValidForMono, options, monoResolver);
        let events = eventBus.getEvents();
        expect(events).to.have.length(1);
        expect(events[0].constructor.name).to.be.equal(`${OpenURL.name}`);
    });

    test(`${OpenURL.name} event is created with the omnisharp-vscode github repo issues url`, async () => {
        await reportIssue(vscode, eventStream, execChildProcess, false, options, monoResolver);
        expect(execCommands).to.not.contain("mono --version");
        let url = (<OpenURL>eventBus.getEvents()[0]).url;
        expect(url).to.include("https://github.com/OmniSharp/omnisharp-vscode/issues/new");
    });

    test("The url contains the vscode version", async () => {
        await reportIssue(vscode, eventStream, execChildProcess, isValidForMono, options, monoResolver);
        let url = (<OpenURL>eventBus.getEvents()[0]).url;
        expect(url).to.include(encodeURIComponent(encodeURIComponent(`**VSCode version**: ${vscodeVersion}`)));
    });

    test("The body contains the csharp extension version", async () => {
        await reportIssue(vscode, eventStream, execChildProcess, isValidForMono, options, monoResolver);
        let url = (<OpenURL>eventBus.getEvents()[0]).url;
        expect(url).to.include(encodeURIComponent(encodeURIComponent(`**C# Extension**: ${csharpExtVersion}`)));
    });

    test("dotnet info is obtained and put into the url", async () => {
        await reportIssue(vscode, eventStream, execChildProcess, isValidForMono, options, monoResolver);
        expect(execCommands).to.contain("dotnet --info");
        let url = (<OpenURL>eventBus.getEvents()[0]).url;
        expect(url).to.contain(dotnetInfo);
    });

    test("mono information is obtained when it is a valid mono platform", async () => {
        await reportIssue(vscode, eventStream, execChildProcess, isValidForMono, options, monoResolver);
        expect(shouldUseGlobalMonoCalled).to.be.equal(true);
    });

    test("mono version is put in the body when shouldUseGlobalMono returns a monoInfo", async () => {
        await reportIssue(vscode, eventStream, execChildProcess, isValidForMono, options, monoResolver);
        expect(shouldUseGlobalMonoCalled).to.be.equal(true);
        let url = (<OpenURL>eventBus.getEvents()[0]).url;
        expect(url).to.contain(monoInfo.version);
    });

    test("built-in mono usage message is put in the body when shouldUseGlobalMono returns a null", async () => {
        monoResolver = {
            getGlobalMonoInfo: () => {
                shouldUseGlobalMonoCalled = true;
                return Promise.resolve(undefined);
            }
        };

        await reportIssue(vscode, eventStream, execChildProcess, isValidForMono, options, monoResolver);
        expect(shouldUseGlobalMonoCalled).to.be.equal(true);
        let url = (<OpenURL>eventBus.getEvents()[0]).url;
        expect(url).to.contain(encodeURIComponent(encodeURIComponent(`OmniSharp using built-in mono`)));
    });

    test("mono information is not obtained when it is not a valid mono platform", async () => {
        await reportIssue(vscode, eventStream, execChildProcess, false, options, monoResolver);
        expect(shouldUseGlobalMonoCalled).to.be.equal(false);
    });

    test("The url contains the name, publisher and version for all the extensions that are not builtin", async () => {
        await reportIssue(vscode, eventStream, execChildProcess, isValidForMono, options, monoResolver);
        let url = (<OpenURL>eventBus.getEvents()[0]).url;
        expect(url).to.contain(extension2.packageJSON.name);
        expect(url).to.contain(extension2.packageJSON.publisher);
        expect(url).to.contain(extension2.packageJSON.version);
        expect(url).to.not.contain(extension1.packageJSON.name);
        expect(url).to.not.contain(extension1.packageJSON.publisher);
        expect(url).to.not.contain(extension1.packageJSON.version);
    });
});