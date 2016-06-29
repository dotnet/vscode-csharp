/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as child_process from 'child_process';

export enum SupportedPlatform {
    None,
    Windows,
    OSX,
    CentOS,
    Debian,
    Fedora,
    OpenSUSE,
    RHEL,
    Ubuntu14,
    Ubuntu16
}

export function getSupportedPlatform() {
    if (process.platform === 'win32') {
        return SupportedPlatform.Windows;
    }
    else if (process.platform === 'darwin') {
        return SupportedPlatform.OSX;
    }
    else if (process.platform === 'linux') {
        // Get the text of /etc/os-release to discover which Linux distribution we're running on.
        // For details: https://www.freedesktop.org/software/systemd/man/os-release.html
        const text = child_process.execSync('cat /etc/os-release').toString();
        const lines = text.split('\n');

        function getValue(name: string) {
            for (let line of lines) {
                if (line.startsWith(name)) {
                    const equalsIndex = line.indexOf('=');
                    if (equalsIndex >= 0) {
                        let value = line.substring(equalsIndex + 1);

                        // Strip double quotes if necessary
                        if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
                            value = value.substring(1, value.length - 2);
                        }

                        return value;
                    }
                }
            }

            return undefined;
        }

        const id = getValue("ID");

        switch (id)
        {
            case 'ubuntu':
                const versionId = getValue("VERSION_ID");
                if (versionId.startsWith("14")) {
                    // This also works for Linux Mint
                    return SupportedPlatform.Ubuntu14;
                }
                else if (versionId.startsWith("16")) {
                    return SupportedPlatform.Ubuntu16;
                }
            case 'centos':
                return SupportedPlatform.CentOS;
            case 'fedora':
                return SupportedPlatform.Fedora;
            case 'opensuse':
                return SupportedPlatform.OpenSUSE;
            case 'rehl':
                return SupportedPlatform.RHEL;
            case 'debian':
                return SupportedPlatform.Debian;
            case 'ol':
                // Oracle Linux is binary compatible with CentOS
                return SupportedPlatform.CentOS;
        }
    }

    return SupportedPlatform.None;	
}
