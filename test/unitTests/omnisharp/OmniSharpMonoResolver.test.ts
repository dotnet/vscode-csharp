/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmniSharpMonoResolver } from "../../../src/omnisharp/OmniSharpMonoResolver";

import { Options } from "../../../src/shared/options";
import { use as chaiUse, expect } from "chai";
import { join } from "path";
import { getEmptyOptions } from "../Fakes/FakeOptions";

chaiUse(require('chai-as-promised'));

suite(`${OmniSharpMonoResolver.name}`, () => {
    let getMonoCalled: boolean;
    let options: Options;

    const monoPath = "monoPath";

    const lowerMonoVersion = "6.2.0";
    const requiredMonoVersion = "6.4.0";
    const higherMonoVersion = "6.6.0";

    const getMono = (version: string) => async (env: NodeJS.ProcessEnv) => {
        getMonoCalled = true;
        return Promise.resolve(version);
    };

    setup(() => {
        getMonoCalled = false;
        options = getEmptyOptions();
    });

    test(`it returns the path and version if the version is greater than or equal to ${requiredMonoVersion}`, async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono(higherMonoVersion));
        let monoInfo = await monoResolver.getHostExecutableInfo({
            ...options,
            omnisharpOptions: { ...options.omnisharpOptions, monoPath: monoPath },
        });

        expect(monoInfo.version).to.be.equal(higherMonoVersion);
        expect(monoInfo.path).to.be.equal(monoPath);
    });

    test(`it throws exception if version is less than ${requiredMonoVersion}`, async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono(lowerMonoVersion));

        await expect(monoResolver.getHostExecutableInfo({
            ...options,
            omnisharpOptions: { ...options.omnisharpOptions, monoPath: monoPath },
        })).to.be.rejected;
    });

    test("sets the environment with the monoPath", async () => {
        let monoResolver = new OmniSharpMonoResolver(getMono(requiredMonoVersion));
        let monoInfo = await monoResolver.getHostExecutableInfo({
            ...options,
            omnisharpOptions: { ...options.omnisharpOptions, monoPath: monoPath },
        });

        expect(getMonoCalled).to.be.equal(true);
        expect(monoInfo.env["PATH"]).to.contain(join(monoPath, 'bin'));
        expect(monoInfo.env["MONO_GAC_PREFIX"]).to.be.equal(monoPath);
    });
});
