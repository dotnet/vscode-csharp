/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { installRuntimeDependencies } from "../../src/InstallRuntimeDependencies";
import IInstallDependencies from "../../src/packageManager/IInstallDependencies";
import { EventStream } from "../../src/EventStream";
import { PlatformInformation } from "../../src/platform";
import * as chai from "chai";
import TestEventBus from "./testAssets/TestEventBus";
import { AbsolutePathPackage } from "../../src/packageManager/AbsolutePathPackage";
import { Package } from "../../src/packageManager/Package";

const expect = chai.expect;

suite(`${installRuntimeDependencies.name}`, () => {
    let packageJSON = {
        runtimeDependencies: {}
    };

    let extensionPath = "/ExtensionPath";
    let installDependencies: IInstallDependencies;
    let eventStream: EventStream;
    let eventBus: TestEventBus;
    let platformInfo = new PlatformInformation("platform1", "architecture1");

    setup(() => {
        eventStream = new EventStream();
        eventBus = new TestEventBus(eventStream);
        installDependencies = async () => Promise.resolve(true);
    });

    suite("When all the dependencies already exist", () => {
        suiteSetup(() => {
            packageJSON = {
                runtimeDependencies: {}
            };
        });

        test("True is returned", async () => {
            let installed = await installRuntimeDependencies(packageJSON, extensionPath, installDependencies, eventStream, platformInfo);
            expect(installed).to.be.true;
        });

        test("Doesn't log anything to the eventStream", async () => {
            let packageJSON = {
                runtimeDependencies: {}
            };

            await installRuntimeDependencies(packageJSON, extensionPath, installDependencies, eventStream, platformInfo);
            expect(eventBus.getEvents()).to.be.empty;
        });
    });

    suite("When there is a dependency to install", () => {
        let packageToInstall: Package = {
            id: "myPackage",
            description: "somePackage",
            installPath: "installPath",
            binaries: [],
            url: "myUrl",
            platforms: [platformInfo.platform],
            architectures: [platformInfo.architecture]
        };

        setup(() => {
            packageJSON = {
                runtimeDependencies: [packageToInstall]
            };
        });

        test("Calls installDependencies with the absolute path package and returns true after successful installation", async () => {
            let inputPackage: AbsolutePathPackage[];
            installDependencies = async (packages) => {
                inputPackage = packages;
                return Promise.resolve(true);
            };

            let installed = await installRuntimeDependencies(packageJSON, extensionPath, installDependencies, eventStream, platformInfo);
            expect(installed).to.be.true;
            expect(inputPackage).to.have.length(1);
            expect(inputPackage[0]).to.be.deep.equal(AbsolutePathPackage.getAbsolutePathPackage(packageToInstall, extensionPath));
        });

        test("Returns false when installDependencies returns false", async () => {
            installDependencies = async () => Promise.resolve(false);
            let installed = await installRuntimeDependencies(packageJSON, extensionPath, installDependencies, eventStream, platformInfo);
            expect(installed).to.be.false;
        });
    });
});