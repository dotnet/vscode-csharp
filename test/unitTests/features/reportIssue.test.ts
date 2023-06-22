/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getFakeVsCode } from "../testAssets/Fakes";
import reportIssue from "../../../src/shared/reportIssue";
import { expect } from "chai";
import { vscode } from "../../../src/vscodeAdapter";
import { Options } from "../../../src/shared/options";
import { FakeMonoResolver, fakeMonoInfo } from "../Fakes/FakeMonoResolver";
import { FakeDotnetResolver } from "../Fakes/FakeDotnetResolver";
import { DotnetInfo } from "../../../src/shared/utils/getDotnetInfo";
import { getEmptyOptions } from "../Fakes/FakeOptions";

suite(`${reportIssue.name}`, () => {
    const vscodeVersion = "myVersion";
    const csharpExtVersion = "csharpExtVersion";
    const isValidForMono = true;
    let vscode: vscode;
    const extension1 = {
        packageJSON: {
            name: "name1",
            publisher: "publisher1",
            version: "version1",
            isBuiltin: true
        },
        id: "id1",
        extensionPath: "c:/extensions/abc-x64"
    };

    const extension2 = {
        packageJSON: {
            name: "name2",
            publisher: "publisher2",
            version: "version2",
            isBuiltin: false
        },
        id: "id2",
        extensionPath: "c:/extensions/xyz-x64"
    };

    const fakeDotnetInfo: DotnetInfo = {
        FullInfo: "myDotnetInfo",
        Version: "1.0.x",
        RuntimeId: "win10-x64"
    };

    let fakeMonoResolver: FakeMonoResolver;
    let fakeDotnetResolver : FakeDotnetResolver;
    let getDotnetInfo = async () => Promise.resolve(fakeDotnetInfo);
    let options: Options;
    let issueBody: string;

    setup(() => {
        vscode = getFakeVsCode();
        vscode.commands.executeCommand = async (command: string, ...rest: any[]) => {
            issueBody = rest[0].issueBody;
            return undefined;
        };

        vscode.version = vscodeVersion;
        vscode.extensions.all = [extension1, extension2];
        fakeMonoResolver = new FakeMonoResolver();
        fakeDotnetResolver = new FakeDotnetResolver();
        options = getEmptyOptions();
    });

    suite("The body is passed to the vscode clipboard and", () => {
        test("it contains the vscode version", async () => {
            await reportIssue(vscode, csharpExtVersion, getDotnetInfo, isValidForMono, options, fakeDotnetResolver, fakeMonoResolver);
            expect(issueBody).to.include(`**VSCode version**: ${vscodeVersion}`);
        });

        test("it contains the csharp extension version", async () => {
            await reportIssue(vscode, csharpExtVersion, getDotnetInfo, isValidForMono, options, fakeDotnetResolver, fakeMonoResolver);
            expect(issueBody).to.include(`**C# Extension**: ${csharpExtVersion}`);
        });

        test("it contains dotnet info", async () => {
            await reportIssue(vscode, csharpExtVersion, getDotnetInfo, isValidForMono, options, fakeDotnetResolver, fakeMonoResolver);
            expect(issueBody).to.contain(fakeDotnetInfo.FullInfo);
        });

        test("mono information is obtained when it is a valid mono platform", async () => {
            await reportIssue(vscode, csharpExtVersion, getDotnetInfo, isValidForMono, options, fakeDotnetResolver, fakeMonoResolver);
            expect(fakeMonoResolver.getMonoCalled).to.be.equal(true);
        });

        test("mono version is put in the body when it is a valid mono platform", async () => {
            await reportIssue(vscode, csharpExtVersion, getDotnetInfo, isValidForMono, options, fakeDotnetResolver, fakeMonoResolver);
            expect(fakeMonoResolver.getMonoCalled).to.be.equal(true);
            expect(issueBody).to.contain(fakeMonoInfo.version);
        });

        test("mono information is not obtained when it is not a valid mono platform", async () => {
            await reportIssue(vscode, csharpExtVersion, getDotnetInfo, false, options, fakeDotnetResolver, fakeMonoResolver);
            expect(fakeMonoResolver.getMonoCalled).to.be.equal(false);
        });

        test("The url contains the name, publisher and version for all the extensions that are not builtin", async () => {
            await reportIssue(vscode, csharpExtVersion, getDotnetInfo, isValidForMono, options, fakeDotnetResolver, fakeMonoResolver);
            expect(issueBody).to.contain(extension2.packageJSON.name);
            expect(issueBody).to.contain(extension2.packageJSON.publisher);
            expect(issueBody).to.contain(extension2.packageJSON.version);
            expect(issueBody).to.not.contain(extension1.packageJSON.name);
            expect(issueBody).to.not.contain(extension1.packageJSON.publisher);
            expect(issueBody).to.not.contain(extension1.packageJSON.version);
        });
    });
});
