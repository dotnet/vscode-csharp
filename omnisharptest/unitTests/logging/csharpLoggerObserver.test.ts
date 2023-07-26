/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { getNullChannel } from '../testAssets/fakes';
import { CsharpLoggerObserver } from '../../../src/shared/observers/csharpLoggerObserver';
import { PlatformInformation } from '../../../src/shared/platform';
import * as Event from '../../../src/omnisharp/loggingEvents';
import { PackageError } from '../../../src/packageManager/packageError';
import { Package } from '../../../src/packageManager/package';

suite('CsharpLoggerObserver', () => {
    suiteSetup(() => should());

    let logOutput = '';
    const observer = new CsharpLoggerObserver({
        ...getNullChannel(),
        append: (text?: string) => {
            logOutput += text || '';
        },
    });
    const pkg: Package = {
        id: 'id',
        description: 'description',
        url: 'url',
        platforms: [],
        architectures: [],
    };

    setup(() => {
        logOutput = '';
    });

    test('PlatformInfo: Logs contain the Platform and Architecture', () => {
        const event = new Event.LogPlatformInfo(new PlatformInformation('linux', 'MyArchitecture'));
        observer.post(event);
        expect(logOutput).to.contain('linux');
        expect(logOutput).to.contain('MyArchitecture');
    });

    suite('InstallationFailure', () => {
        test('Stage and Error is logged if not a PackageError', () => {
            const event = new Event.InstallationFailure('someStage', new Error('someError'));
            observer.post(event);
            expect(logOutput).to.contain(event.stage);
            expect(logOutput).to.contain(event.error.toString());
        });

        test('Stage and Error is logged if a PackageError without inner error', () => {
            const event = new Event.InstallationFailure('someStage', new PackageError('someError', pkg, undefined));
            observer.post(event);
            expect(logOutput).to.contain(event.stage);
            expect(logOutput).to.contain(event.error.message);
        });

        test('Stage and Inner error is logged if a PackageError without inner error', () => {
            const event = new Event.InstallationFailure(
                'someStage',
                new PackageError('someError', pkg, new Error('innerError'))
            );
            observer.post(event);
            expect(logOutput).to.contain(event.stage);
            expect(logOutput).to.contain(event.error.innerError.toString());
        });
    });

    suite('Download', () => {
        const packageName = 'somePackage';
        [
            {
                events: [],
                expected: '',
            },
            {
                events: [new Event.DownloadStart('somePackage')],
                expected: "Downloading package 'somePackage' ",
            },
            {
                events: [
                    new Event.DownloadStart('somePackage'),
                    new Event.DownloadSizeObtained(500),
                    new Event.DownloadProgress(100, packageName),
                ],
                expected: "Downloading package 'somePackage' (1 KB)....................",
            },
            {
                events: [
                    new Event.DownloadStart('somePackage'),
                    new Event.DownloadSizeObtained(500),
                    new Event.DownloadProgress(10, packageName),
                    new Event.DownloadProgress(50, packageName),
                    new Event.DownloadProgress(100, packageName),
                ],
                expected: "Downloading package 'somePackage' (1 KB)....................",
            },
            {
                events: [
                    new Event.DownloadStart('somePackage'),
                    new Event.DownloadSizeObtained(500),
                    new Event.DownloadProgress(10, packageName),
                    new Event.DownloadProgress(50, packageName),
                ],
                expected: "Downloading package 'somePackage' (1 KB)..........",
            },
            {
                events: [
                    new Event.DownloadStart('somePackage'),
                    new Event.DownloadSizeObtained(2000),
                    new Event.DownloadProgress(50, packageName),
                ],
                expected: "Downloading package 'somePackage' (2 KB)..........",
            },
            {
                events: [
                    new Event.DownloadStart('somePackage'),
                    new Event.DownloadSizeObtained(2000),
                    new Event.DownloadProgress(50, packageName),
                    new Event.DownloadProgress(50, packageName),
                    new Event.DownloadProgress(50, packageName),
                ],
                expected: "Downloading package 'somePackage' (2 KB)..........",
            },
            {
                events: [
                    new Event.DownloadStart('somePackage'),
                    new Event.DownloadSizeObtained(3000),
                    new Event.DownloadProgress(100, packageName),
                    new Event.DownloadSuccess('Done'),
                ],
                expected: "Downloading package 'somePackage' (3 KB)....................Done\n",
            },
            {
                events: [
                    new Event.DownloadStart('somePackage'),
                    new Event.DownloadSizeObtained(4000),
                    new Event.DownloadProgress(50, packageName),
                    new Event.DownloadFailure('Failed'),
                ],
                expected: "Downloading package 'somePackage' (4 KB)..........Failed\n",
            },
        ].forEach((element) => {
            test(`Prints the download status to the logger as ${element.expected}`, () => {
                let logOutput = '';

                const observer = new CsharpLoggerObserver({
                    ...getNullChannel(),
                    appendLine: (text?: string) => {
                        logOutput += `${text}\n`;
                    },
                    append: (text?: string) => {
                        logOutput += text;
                    },
                });

                element.events.forEach((message: Event.BaseEvent) => observer.post(message));
                expect(logOutput).to.be.equal(element.expected);
            });
        });
    });

    [
        {
            message: new Event.DebuggerPrerequisiteFailure('Some failure message'),
            expected: `Some failure message`,
        },
        {
            message: new Event.DebuggerPrerequisiteWarning('Some warning message'),
            expected: `Some warning message`,
        },
    ].forEach((element) =>
        test(`${element.message.constructor.name} is shown`, () => {
            observer.post(element.message);
            expect(logOutput).to.contain(element.expected);
        })
    );

    test(`ActivationFailure: Some message is logged`, () => {
        const event = new Event.ActivationFailure();
        observer.post(event);
        expect(logOutput).to.not.be.empty;
    });

    test(`ProjectJsonDeprecatedWarning: Some message is logged`, () => {
        const event = new Event.ProjectJsonDeprecatedWarning();
        observer.post(event);
        expect(logOutput).to.not.be.empty;
    });

    test(`InstallationSuccess: Some message is logged`, () => {
        const event = new Event.InstallationSuccess();
        observer.post(event);
        expect(logOutput).to.not.be.empty;
    });

    test(`InstallationProgress: Progress message is logged`, () => {
        const event = new Event.InstallationStart('somPackage');
        observer.post(event);
        expect(logOutput).to.contain(event.packageDescription);
    });

    test('PackageInstallation: Package name is logged', () => {
        const event = new Event.PackageInstallation('somePackage');
        observer.post(event);
        expect(logOutput).to.contain(event.packageInfo);
    });

    test('DownloadFallBack: The fallbackurl is logged', () => {
        const event = new Event.DownloadFallBack('somrurl');
        observer.post(event);
        expect(logOutput).to.contain(event.fallbackUrl);
    });

    test(`${Event.IntegrityCheckFailure.name}: Package Description is logged when we are retrying`, () => {
        const description = 'someDescription';
        const url = 'someUrl';
        const event = new Event.IntegrityCheckFailure(description, url, true);
        observer.post(event);
        expect(logOutput).to.contain(description);
    });

    test(`${Event.IntegrityCheckFailure.name}: Package Description and url are logged when we are not retrying`, () => {
        const description = 'someDescription';
        const url = 'someUrl';
        const event = new Event.IntegrityCheckFailure(description, url, false);
        observer.post(event);
        expect(logOutput).to.contain(description);
        expect(logOutput).to.contain(url);
    });

    test(`${Event.IntegrityCheckSuccess.name}: Some message is logged`, () => {
        const event = new Event.IntegrityCheckSuccess();
        observer.post(event);
        expect(logOutput).to.not.be.empty;
    });
});
