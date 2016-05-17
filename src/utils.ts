/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as child_process from 'child_process'

export enum SupportedPlatform {
    None,
    Windows,
    OSX,
    CentOS,
    Debian,
    RHEL,
    Ubuntu
}

export function getSupportedPlatform() {
    if (process.platform === 'win32') {
        return SupportedPlatform.Windows;
    }
    else if (process.platform === 'darwin') {
        return SupportedPlatform.OSX;
    }
    else if (process.platform === 'linux') {
        // Get the text of /etc/*-release to discover which Linux distribution we're running on.
        let release = child_process.execSync('cat /etc/os-release').toString().toLowerCase();

        if (release.indexOf('ubuntu') >= 0) {
            return SupportedPlatform.Ubuntu;
        }
        else if (release.indexOf('centos') >= 0) {
            return SupportedPlatform.CentOS;
        }
        else if (release.indexOf('rhel') >= 0) {
            return SupportedPlatform.RHEL;
        }
        else if (release.indexOf('debian') >= 0) {
            return SupportedPlatform.Debian;
        }
    }

    return SupportedPlatform.None;	
}
