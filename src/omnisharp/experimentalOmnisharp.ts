/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as util from '../common';
import * as path from 'path';
import * as semver from 'semver';

export function GetExperimentalOmnisharpPath(optionsPath: string): string{
    // Looks at the options path, installs the dependenices and returns the path to be loaded by the omnisharp server
    // To Do : Add the functionality for the latest option
    
    if (util.fileExists(optionsPath)) {
        // The file is a valid file on disk
        return optionsPath;
    }

    let extensionPath = util.getExtensionPath();
    // If it is not a valid path, it might be a version that the user wants to use
    if (IsValidSemver(optionsPath)) {
        if (DownloadAndInstallExperimentalVersion(optionsPath)) {
            // Download and install completed successfully otherwise the error thrown will be handled by the server
            return path.resolve(extensionPath, `.omnisharp/experimental/${optionsPath}`);
        }
    }
    else {
        throw new Error('Bad Input to Omnisharp Path');
    }
}

function IsValidSemver(version: string): boolean {
    if (semver.valid(version)) {
        return true;
    }

    return false;
}