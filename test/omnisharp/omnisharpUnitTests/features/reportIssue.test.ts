/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import reportIssue from '../../../../src/shared/reportIssue';
import { FakeMonoResolver, fakeMonoInfo } from '../fakes/fakeMonoResolver';
import { FakeDotnetResolver } from '../fakes/fakeDotnetResolver';
import { DotnetInfo } from '../../../../src/shared/utils/dotnetInfo';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

describe(`${reportIssue.name}`, () => {
    const vscodeVersion = 'myVersion';
    const csharpExtVersion = 'csharpExtVersion';
    const isValidForMono = true;
    const extension1 = {
        packageJSON: {
            name: 'name1',
            publisher: 'publisher1',
            version: 'version1',
            isBuiltin: true,
        },
        id: 'id1',
        extensionPath: 'c:/extensions/abc-x64',
    } as vscode.Extension<any>;

    const extension2 = {
        packageJSON: {
            name: 'name2',
            publisher: 'publisher2',
            version: 'version2',
            isBuiltin: false,
        },
        id: 'id2',
        extensionPath: 'c:/extensions/xyz-x64',
    } as vscode.Extension<any>;

    const fakeDotnetInfo: DotnetInfo = {
        FullInfo: 'myDotnetInfo',
        Version: '1.0.x',
        RuntimeId: 'win10-x64',
        Runtimes: {},
    };

    let fakeMonoResolver: FakeMonoResolver;
    let fakeDotnetResolver: FakeDotnetResolver;
    const getDotnetInfo = async () => Promise.resolve(fakeDotnetInfo);
    let issueBody: string;

    beforeEach(() => {
        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            get: jest.fn((_config: string) => {
                return undefined;
            }),
            has: jest.fn(),
            inspect: jest.fn(),
            update: jest.fn(),
        } as vscode.WorkspaceConfiguration);

        jest.spyOn(vscode.commands, 'executeCommand').mockImplementation(async (command: string, ...rest: any[]) => {
            issueBody = rest[0].issueBody;
            return {} as any;
        });
        jest.replaceProperty(vscode.extensions, "all", [extension1, extension2] as readonly vscode.Extension<any>[]);

        fakeMonoResolver = new FakeMonoResolver();
        fakeDotnetResolver = new FakeDotnetResolver();
    });

    describe('The body is passed to the vscode clipboard and', () => {
        test('it contains the vscode version', async () => {
            await reportIssue(csharpExtVersion, getDotnetInfo, isValidForMono, fakeDotnetResolver, fakeMonoResolver);
            expect(issueBody).toContain(`**VSCode version**: ${vscodeVersion}`);
        });

        test('it contains the csharp extension version', async () => {
            await reportIssue(csharpExtVersion, getDotnetInfo, isValidForMono, fakeDotnetResolver, fakeMonoResolver);
            expect(issueBody).toContain(`**C# Extension**: ${csharpExtVersion}`);
        });

        test('it contains dotnet info', async () => {
            await reportIssue(csharpExtVersion, getDotnetInfo, isValidForMono, fakeDotnetResolver, fakeMonoResolver);
            expect(issueBody).toContain(fakeDotnetInfo.FullInfo);
        });

        test('mono information is obtained when it is a valid mono platform', async () => {
            await reportIssue(csharpExtVersion, getDotnetInfo, isValidForMono, fakeDotnetResolver, fakeMonoResolver);
            expect(fakeMonoResolver.getMonoCalled).toEqual(true);
        });

        test('mono version is put in the body when it is a valid mono platform', async () => {
            await reportIssue(csharpExtVersion, getDotnetInfo, isValidForMono, fakeDotnetResolver, fakeMonoResolver);
            expect(fakeMonoResolver.getMonoCalled).toEqual(true);
            expect(issueBody).toContain(fakeMonoInfo.version);
        });

        test('mono information is not obtained when it is not a valid mono platform', async () => {
            await reportIssue(csharpExtVersion, getDotnetInfo, false, fakeDotnetResolver, fakeMonoResolver);
            expect(fakeMonoResolver.getMonoCalled).toEqual(false);
        });

        test('The url contains the name, publisher and version for all the extensions that are not builtin', async () => {
            await reportIssue(csharpExtVersion, getDotnetInfo, isValidForMono, fakeDotnetResolver, fakeMonoResolver);
            expect(issueBody).toContain(extension2.packageJSON.name);
            expect(issueBody).toContain(extension2.packageJSON.publisher);
            expect(issueBody).toContain(extension2.packageJSON.version);
            expect(issueBody).not.toContain(extension1.packageJSON.name);
            expect(issueBody).not.toContain(extension1.packageJSON.publisher);
            expect(issueBody).not.toContain(extension1.packageJSON.version);
        });
    });
});
