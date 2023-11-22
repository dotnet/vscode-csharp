/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach } from '@jest/globals';
import { installRuntimeDependencies } from '../../src/installRuntimeDependencies';
import IInstallDependencies from '../../src/packageManager/IInstallDependencies';
import { EventStream } from '../../src/eventStream';
import { PlatformInformation } from '../../src/shared/platform';
import TestEventBus from '../omnisharpUnitTests/testAssets/testEventBus';
import { AbsolutePathPackage } from '../../src/packageManager/absolutePathPackage';
import { Package } from '../../src/packageManager/package';
import { isNotNull } from '../testUtil';

describe(`${installRuntimeDependencies.name}`, () => {
    let packageJSON = {
        runtimeDependencies: [] as Package[],
    };

    const extensionPath = '/ExtensionPath';
    let installDependencies: IInstallDependencies;
    let eventStream: EventStream;
    let eventBus: TestEventBus;
    const platformInfo = new PlatformInformation('linux', 'architecture1');
    const useFramework = true;

    beforeEach(() => {
        eventStream = new EventStream();
        eventBus = new TestEventBus(eventStream);
        installDependencies = async () => Promise.resolve(true);
    });

    describe('When all the dependencies already exist', () => {
        beforeEach(() => {
            packageJSON = {
                runtimeDependencies: [],
            };
        });

        test('True is returned', async () => {
            const installed = await installRuntimeDependencies(
                packageJSON,
                extensionPath,
                installDependencies,
                eventStream,
                platformInfo,
                useFramework,
                ['Debugger', 'Omnisharp', 'Razor']
            );
            expect(installed).toBe(true);
        });

        test("Doesn't log anything to the eventStream", async () => {
            packageJSON = {
                runtimeDependencies: [],
            };

            await installRuntimeDependencies(
                packageJSON,
                extensionPath,
                installDependencies,
                eventStream,
                platformInfo,
                useFramework,
                ['Debugger', 'Omnisharp', 'Razor']
            );
            expect(eventBus.getEvents()).toHaveLength(0);
        });
    });

    describe('When there is a dependency to install', () => {
        const packageToInstall: Package = {
            id: 'myPackage',
            description: 'somePackage',
            installPath: 'installPath',
            binaries: [],
            url: 'myUrl',
            platforms: [platformInfo.platform],
            architectures: [platformInfo.architecture],
        };

        beforeEach(() => {
            packageJSON = {
                runtimeDependencies: [packageToInstall],
            };
        });

        test('Calls installDependencies with the absolute path package and returns true after successful installation', async () => {
            let inputPackage: AbsolutePathPackage[];
            installDependencies = async (packages) => {
                inputPackage = packages;
                return Promise.resolve(true);
            };

            const installed = await installRuntimeDependencies(
                packageJSON,
                extensionPath,
                installDependencies,
                eventStream,
                platformInfo,
                useFramework,
                ['myPackage']
            );
            expect(installed).toBe(true);
            isNotNull(inputPackage!);
            expect(inputPackage).toHaveLength(1);
            expect(inputPackage[0]).toStrictEqual(
                AbsolutePathPackage.getAbsolutePathPackage(packageToInstall, extensionPath)
            );
        });

        test('Returns false when installDependencies returns false', async () => {
            installDependencies = async () => Promise.resolve(false);
            const installed = await installRuntimeDependencies(
                packageJSON,
                extensionPath,
                installDependencies,
                eventStream,
                platformInfo,
                useFramework,
                ['myPackage']
            );
            expect(installed).toBe(false);
        });
    });
});
