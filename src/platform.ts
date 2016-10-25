/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs';
import * as os from 'os';

/**
 * There is no standard way on Linux to find the distribution name and version.
 * Recently, systemd has pushed to standardize the os-release file. This has
 * seen adoption in "recent" versions of all major distributions.
 * https://www.freedesktop.org/software/systemd/man/os-release.html
 */
export class LinuxDistribution {
    constructor(public name: string, public version: string) { }

    public static GetCurrent(): Promise<LinuxDistribution> {
        // Try /etc/os-release and fallback to /usr/lib/os-release per the synopsis
        // at https://www.freedesktop.org/software/systemd/man/os-release.html.
        return LinuxDistribution.FromFilePath('/etc/os-release')
            .catch(() => LinuxDistribution.FromFilePath('/usr/lib/os-release'))
            .catch(() => Promise.resolve(new LinuxDistribution('unknown', 'unknown')));
    }

    private static FromFilePath(filePath: string): Promise<LinuxDistribution> {
        return new Promise<LinuxDistribution>((resolve, reject) => {
            fs.readFile(filePath, 'utf8', (error, data) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(LinuxDistribution.FromReleaseInfo(data));
                }
            });
        });
    }

    public static FromReleaseInfo(releaseInfo: string): LinuxDistribution {
        let name = 'unknown';
        let version = 'unknown';

        const lines = releaseInfo.split(os.EOL);
        for (let line of lines) {
            line = line.trim();

            let equalsIndex = line.indexOf('=');
            if (equalsIndex >= 0) {
                let key = line.substring(0, equalsIndex);
                let value = line.substring(equalsIndex + 1);

                // Strip double quotes if necessary
                if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
                    value = value.substring(1, value.length - 1);
                }

                if (key === 'ID') {
                    name = value;
                }
                else if (key === 'VERSION_ID') {
                    version = value;
                }

                if (name !== 'unknown' && version !== 'unknown') {
                    break;
                }
            }
        }

        return new LinuxDistribution(name, version);
    }
}

export enum Platform {
    Unknown,
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

export function getCurrentPlatform(): Promise<Platform> {
    if (process.platform === 'win32') {
        return Promise.resolve(Platform.Windows);
    }
    else if (process.platform === 'darwin') {
        return Promise.resolve(Platform.OSX);
    }
    else if (process.platform === 'linux') {
        return LinuxDistribution.GetCurrent().then(distro => {
            switch (distro.name)
            {
                case 'ubuntu':
                    if (distro.version.startsWith("14")) {
                        // This also works for Linux Mint
                        return Platform.Ubuntu14;
                    }
                    else if (distro.version.startsWith("16")) {
                        return Platform.Ubuntu16;
                    }

                    break;
                case 'centos':
                    return Platform.CentOS;
                case 'fedora':
                    return Platform.Fedora;
                case 'opensuse':
                    return Platform.OpenSUSE;
                case 'rhel':
                    return Platform.RHEL;
                case 'debian':
                    return Platform.Debian;
                case 'ol':
                    // Oracle Linux is binary compatible with CentOS
                    return Platform.CentOS;
                case 'elementary':
                case 'elementary OS':
                    if (distro.version.startsWith("0.3")) {
                        // Elementary OS 0.3 Freya is binary compatible with Ubuntu 14.04
                        return Platform.Ubuntu14;
                    }
                    else if (distro.version.startsWith("0.4")) {
                        // Elementary OS 0.4 Loki is binary compatible with Ubuntu 16.04
                        return Platform.Ubuntu16;
                    }

                    break;
                case 'linuxmint':
                    if (distro.version.startsWith("18")) {
                        // Linux Mint 18 is binary compatible with Ubuntu 16.04
                        return Platform.Ubuntu16;
                    }

                    break;
            }
        });
    }

    return Promise.resolve(Platform.Unknown);
}
