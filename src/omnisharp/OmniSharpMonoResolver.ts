/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { satisfies } from 'semver';
import * as path from 'path';
import { Options } from './options';
import { IMonoResolver } from '../constants/IMonoResolver';
import { MonoInformation } from '../constants/MonoInformation';
import { IGetMonoVersion } from '../constants/IGetMonoVersion';

export class OmniSharpMonoResolver implements IMonoResolver {
    private minimumMonoVersion = "6.4.0";

    constructor(private getMonoVersion: IGetMonoVersion) {
    }

    private async configureEnvironmentAndGetInfo(options: Options): Promise<MonoInformation> {
        let env = { ...process.env };
        let monoPath: string;
        if (options.useGlobalMono !== "never" && options.monoPath !== undefined) {
            env['PATH'] = path.join(options.monoPath, 'bin') + path.delimiter + env['PATH'];
            env['MONO_GAC_PREFIX'] = options.monoPath;
            monoPath = options.monoPath;
        }

        let version = await this.getMonoVersion(env);

        return {
            version,
            path: monoPath,
            env
        };
    }

    public async getGlobalMonoInfo(options: Options): Promise<MonoInformation> {
        let monoInfo = await this.configureEnvironmentAndGetInfo(options);
        let isValid = monoInfo.version && satisfies(monoInfo.version, `>=${this.minimumMonoVersion}`);
        if (options.useGlobalMono === "always") {
            let isMissing = monoInfo.version === undefined;
            if (isMissing) {
                const suggestedAction = options.monoPath
                    ? "Update the \"omnisharp.monoPath\" setting to point to the folder containing Mono's '/bin' folder."
                    : "Ensure that Mono's '/bin' folder is added to your environment's PATH variable.";
                throw new Error(`Unable to find Mono. ${suggestedAction}`);
            }
            
            if (!isValid) {
                throw new Error(`Found Mono version ${monoInfo.version}. Cannot start OmniSharp because Mono version >=${this.minimumMonoVersion} is required.`);
            }

            return monoInfo;
        }
        else if (options.useGlobalMono === "auto" && isValid) {
            // While waiting for Mono to ship with a MSBuild version 16.8 or higher, we will treat "auto"
            // as "Use included Mono".
            // return monoInfo;
        }

        return undefined;
    }
}

