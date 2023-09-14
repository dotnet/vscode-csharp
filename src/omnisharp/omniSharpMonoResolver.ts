/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as semver from 'semver';
import * as path from 'path';
import { IHostExecutableResolver } from '../shared/constants/IHostExecutableResolver';
import { HostExecutableInformation } from '../shared/constants/hostExecutableInformation';
import { IGetMonoVersion } from '../constants/IGetMonoVersion';
import { omnisharpOptions } from '../shared/options';

export class OmniSharpMonoResolver implements IHostExecutableResolver {
    private readonly minimumMonoVersion = '6.4.0';

    constructor(private getMonoVersion: IGetMonoVersion) {}

    public async getHostExecutableInfo(): Promise<HostExecutableInformation> {
        const env = { ...process.env };

        const monoPath = omnisharpOptions.monoPath.getValue(vscode);
        if (monoPath.length > 0) {
            env['PATH'] = path.join(monoPath, 'bin') + path.delimiter + env['PATH'];
            env['MONO_GAC_PREFIX'] = monoPath;
        }

        const monoVersion = await this.getMonoVersion(env);
        if (monoVersion === undefined) {
            const suggestedAction = monoPath
                ? "Update the \"omnisharp.monoPath\" setting to point to the folder containing Mono's '/bin' folder."
                : "Ensure that Mono's '/bin' folder is added to your environment's PATH variable.";
            throw new Error(`Unable to find Mono. ${suggestedAction}`);
        }

        if (semver.lt(monoVersion, this.minimumMonoVersion)) {
            throw new Error(
                `Found Mono version ${monoVersion}. Minimum required version is ${this.minimumMonoVersion}.`
            );
        }

        return {
            version: monoVersion,
            path: monoPath,
            env,
        };
    }
}
