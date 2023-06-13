/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as semver from 'semver';
import * as path from 'path';
import { IHostExecutableResolver } from '../shared/constants/IHostExecutableResolver';
import { HostExecutableInformation } from '../shared/constants/HostExecutableInformation';
import { IGetMonoVersion } from '../constants/IGetMonoVersion';
import { Options } from '../shared/options';

export class OmniSharpMonoResolver implements IHostExecutableResolver {
    private readonly minimumMonoVersion = "6.4.0";

    constructor(private getMonoVersion: IGetMonoVersion) {
    }

    public async getHostExecutableInfo(options: Options): Promise<HostExecutableInformation> {
        const env = { ...process.env };

        if (options.omnisharpOptions.monoPath.length > 0) {
            env['PATH'] = path.join(options.omnisharpOptions.monoPath, 'bin') + path.delimiter + env['PATH'];
            env['MONO_GAC_PREFIX'] = options.omnisharpOptions.monoPath;
        }

        const monoVersion = await this.getMonoVersion(env);
        if (monoVersion === undefined) {
            const suggestedAction = options.omnisharpOptions.monoPath
                ? "Update the \"omnisharp.monoPath\" setting to point to the folder containing Mono's '/bin' folder."
                : "Ensure that Mono's '/bin' folder is added to your environment's PATH variable.";
            throw new Error(`Unable to find Mono. ${suggestedAction}`);
        }

        if (semver.lt(monoVersion, this.minimumMonoVersion)) {
            throw new Error(`Found Mono version ${monoVersion}. Minimum required version is ${this.minimumMonoVersion}.`);
        }

        return {
            version: monoVersion,
            path: options.omnisharpOptions.monoPath,
            env,
        };
    }
}
