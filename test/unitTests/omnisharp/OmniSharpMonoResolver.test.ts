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
    const getMono = (version: string) => async(env: NodeJS.ProcessEnv) => {
        getMonoCalled = true;
        environment = env;
        return Promise.resolve(version);
    };

    setup(() => {
        getMonoCalled = false;
        options = getEmptyOptions();
    });

    test("it returns undefined if the version is less than 5.8.1 and useGlobalMono is auto", async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono("5.0.0"));
        let monoInfo = await monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "auto",
            monoPath: monoPath
        });
        expect(monoInfo).to.be.undefined;
    });

    test("it returns undefined if useGlobalMono is never", async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono("5.8.2"));
        let monoInfo = await monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "never",
            monoPath: monoPath
        });
        expect(monoInfo).to.be.undefined;
    });

    test("it returns the path and version if the version is greater than or equal to 5.8.1 and getGlobalMonoInfo is always", async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono("5.8.1"));
        let monoInfo = await monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "always",
            monoPath: monoPath
        });

        expect(monoInfo.version).to.be.equal("5.8.1");
        expect(monoInfo.path).to.be.equal(monoPath);
    });

    test("it returns the path and version if the version is greater than or equal to 5.8.1 and getGlobalMonoInfo is auto", async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono("5.8.2"));
        let monoInfo = await monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "auto",
            monoPath: monoPath
        });

        expect(monoInfo.version).to.be.equal("5.8.2");
        expect(monoInfo.path).to.be.equal(monoPath);
    });

    test("it throws exception if getGlobalMonoInfo is always and version<5.8.1", async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono("5.8.0"));

        await expect(monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "always",
            monoPath: monoPath
        })).to.be.rejected;
    });

    test("sets the environment with the monoPath id useGlobalMono is auto", async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono("5.8.1"));
        let monoInfo = await monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "auto",
            monoPath: monoPath
        });

        expect(monoInfo.env["PATH"]).to.contain(join(monoPath, 'bin'));
        expect(monoInfo.env["MONO_GAC_PREFIX"]).to.be.equal(monoPath);
    });

    test("sets the environment with the monoPath id useGlobalMono is always", async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono("5.8.1"));
        let monoInfo = await monoResolver.getGlobalMonoInfo({
            ...options,
            useGlobalMono: "auto",
            monoPath: monoPath
        });

        expect(monoInfo.env["PATH"]).to.contain(join(monoPath, 'bin'));
        expect(monoInfo.env["MONO_GAC_PREFIX"]).to.be.equal(monoPath);
    });

    test("doesn't set the environment with the monoPath if useGlobalMono is never", async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono("5.8.1"));
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
        let monoResolver = new OmniSharpMonoResolver(getMono("5.8.1"));
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