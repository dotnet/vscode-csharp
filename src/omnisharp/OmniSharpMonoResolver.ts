/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as semver from 'semver';
import * as path from 'path';
import { Options } from './options';
import { IHostExecutableResolver } from '../constants/IHostExecutableResolver';
import { HostExecutableInformation } from '../constants/HostExecutableInformation';
import { IGetMonoVersion } from '../constants/IGetMonoVersion';

export class OmniSharpMonoResolver implements IHostExecutableResolver {
    private readonly minimumMonoVersion = "6.4.0";

    constructor(private getMonoVersion: IGetMonoVersion) {
    }

    public async getHostExecutableInfo(options: Options): Promise<HostExecutableInformation> {
        const env = { ...process.env };

        if (options.monoPath.length > 0) {
            env['PATH'] = path.join(options.monoPath, 'bin') + path.delimiter + env['PATH'];
            env['MONO_GAC_PREFIX'] = options.monoPath;
        }

        const monoVersion = await this.getMonoVersion(env);
        if (monoVersion === undefined) {
            const suggestedAction = options.monoPath
                ? "Update the \"omnisharp.monoPath\" setting to point to the folder containing Mono's '/bin' folder."
                : "Ensure that Mono's '/bin' folder is added to your environment's PATH variable.";
            throw new Error(`Unable to find Mono. ${suggestedAction}`);
        }

        if (semver.lt(monoVersion, this.minimumMonoVersion)) {
            throw new Error(`Found Mono version ${monoVersion}. Minimum required version is ${this.minimumMonoVersion}.`);
        }

        return {
            version: monoVersion,
            path: options.monoPath,
            env,
        };
    }
}
