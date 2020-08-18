/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmniSharpMonoResolver } from "../../../src/omnisharp/OmniSharpMonoResolver";

import { Options } from "../../../src/omnisharp/options";
import { use as chaiUse, expect } from "chai";
import { join } from "path";
import { getEmptyOptions } from "../Fakes/FakeOptions";

chaiUse(require('chai-as-promised'));

suite(`${OmniSharpMonoResolver.name}`, () => {
    let getMonoCalled: boolean;
    let environment: NodeJS.ProcessEnv;
    let options: Options;

    const monoPath = "monoPath";

    const lowerMonoVersion = "6.2.0";
    const requiredMonoVersion = "6.4.0";
    const higherMonoVersion = "6.6.0";

    // Sets the meaning of UseGlobalMono "auto". When false, "auto" means "never".
    const autoMeansAlways = false;

    const getMono = (version: string) => async (env: NodeJS.ProcessEnv) => {
        getMonoCalled = true;
        environment = env;
        return Promise.resolve(version);
    };

    setup(() => {
        getMonoCalled = false;
        options = getEmptyOptions();
    });

    test(`it returns undefined if the version is less than ${requiredMonoVersion} and useGlobalMono is auto`, async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono(lowerMonoVersion));
        let monoInfo = await monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "auto",
            monoPath: monoPath
        });
        expect(monoInfo).to.be.undefined;
    });

    test("it returns undefined if useGlobalMono is never", async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono(higherMonoVersion));
        let monoInfo = await monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "never",
            monoPath: monoPath
        });
        expect(monoInfo).to.be.undefined;
    });

    test(`it returns the path and version if the version is greater than or equal to ${requiredMonoVersion} and useGlobalMono is always`, async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono(requiredMonoVersion));
        let monoInfo = await monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "always",
            monoPath: monoPath
        });

        expect(monoInfo.version).to.be.equal(requiredMonoVersion);
        expect(monoInfo.path).to.be.equal(monoPath);
    });

    test(`it returns the path and version if the version is greater than or equal to ${requiredMonoVersion} and useGlobalMono is auto`, async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono(higherMonoVersion));
        let monoInfo = await monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "auto",
            monoPath: monoPath
        });

        if (!autoMeansAlways) {
            expect(monoInfo).to.be.undefined;
        }
        else {
            expect(monoInfo.version).to.be.equal(higherMonoVersion);
            expect(monoInfo.path).to.be.equal(monoPath);
        }
    });

    test(`it throws exception if getGlobalMonoInfo is always and version<${requiredMonoVersion}`, async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono(lowerMonoVersion));

        await expect(monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "always",
            monoPath: monoPath
        })).to.be.rejected;
    });

    test("sets the environment with the monoPath id useGlobalMono is auto", async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono(requiredMonoVersion));
        let monoInfo = await monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "auto",
            monoPath: monoPath
        });

        if (!autoMeansAlways) {
            expect(monoInfo).to.be.undefined;
        }
        else {
            expect(monoInfo.env["PATH"]).to.contain(join(monoPath, 'bin'));
            expect(monoInfo.env["MONO_GAC_PREFIX"]).to.be.equal(monoPath);
        }
    });

    test("sets the environment with the monoPath id useGlobalMono is auto", async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono(requiredMonoVersion));
        let monoInfo = await monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "auto",
            monoPath: monoPath
        });

        if (!autoMeansAlways) {
            expect(monoInfo).to.be.undefined;
        }
        else {
            expect(monoInfo.env["PATH"]).to.contain(join(monoPath, 'bin'));
            expect(monoInfo.env["MONO_GAC_PREFIX"]).to.be.equal(monoPath);
        }
    });

    test("doesn't set the environment with the monoPath if useGlobalMono is never", async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono(requiredMonoVersion));
        await monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "never",
            monoPath: monoPath
        });

        expect(getMonoCalled).to.be.equal(true);
        expect(environment["PATH"] || "").to.not.contain(join(monoPath, 'bin'));
        expect(environment["MONO_GAC_PREFIX"]).to.be.undefined;
    });

    test("getMono is called with the environment that includes the monoPath if the useGlobalMono is auto or always", async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono(requiredMonoVersion));
        await monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "auto",
            monoPath: monoPath
        });

        expect(getMonoCalled).to.be.equal(true);
        expect(environment["PATH"]).to.contain(join(monoPath, 'bin'));
        expect(environment["MONO_GAC_PREFIX"]).to.be.equal(monoPath);
    });
});