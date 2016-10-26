/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as os from 'os';
import * as util from './common';

const unknown = 'unknown';

/**
 * There is no standard way on Linux to find the distribution name and version.
 * Recently, systemd has pushed to standardize the os-release file. This has
 * seen adoption in "recent" versions of all major distributions.
 * https://www.freedesktop.org/software/systemd/man/os-release.html
 */
export class LinuxDistribution {
    constructor(
        public name: string,
        public version: string) { }

    public static GetCurrent(): Promise<LinuxDistribution> {
        // Try /etc/os-release and fallback to /usr/lib/os-release per the synopsis
        // at https://www.freedesktop.org/software/systemd/man/os-release.html.
        return LinuxDistribution.FromFilePath('/etc/os-release')
            .catch(() => LinuxDistribution.FromFilePath('/usr/lib/os-release'))
            .catch(() => Promise.resolve(new LinuxDistribution(unknown, unknown)));
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
        let name = unknown;
        let version = unknown;

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

                if (name !== unknown && version !== unknown) {
                    break;
                }
            }
        }

        return new LinuxDistribution(name, version);
    }
}

export enum OperatingSystem {
    Windows,
    MacOS,
    Linux
}

export enum CoreClrFlavor {
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

export class PlatformInformation {
    constructor(
        public operatingSystem: OperatingSystem,
        public architecture: string,
        public distribution: LinuxDistribution) { }

    public static GetCurrent(): Promise<PlatformInformation> {
        let operatingSystem: OperatingSystem;
        let architecturePromise: Promise<string>;
        let distributionPromise: Promise<LinuxDistribution>;

        switch (os.platform()) {
            case 'win32':
                operatingSystem = OperatingSystem.Windows;
                architecturePromise = PlatformInformation.GetWindowsArchitecture();
                distributionPromise = Promise.resolve(null);
                break;

            case 'darwin':
                operatingSystem = OperatingSystem.MacOS;
                architecturePromise = PlatformInformation.GetUnixArchitecture();
                distributionPromise = Promise.resolve(null);
                break;

            case 'linux':
                operatingSystem = OperatingSystem.Linux; 
                architecturePromise = PlatformInformation.GetUnixArchitecture();
                distributionPromise = LinuxDistribution.GetCurrent();
                break;

            default:
                throw new Error(`Unsupported operating system: ${os.platform()}`);
        }

        return Promise.all([architecturePromise, distributionPromise])
            .then(([arch, distro]) => {
                return new PlatformInformation(operatingSystem, arch, distro)
            });
    }

    private static GetWindowsArchitecture(): Promise<string> {
        return util.execChildProcess('wmic os get osarchitecture')
            .then(architecture => {
                if (architecture) {
                    let archArray: string[] = architecture.split(os.EOL);
                    if (archArray.length >= 2) {
                        return archArray[1].trim();
                    }
                }

                return unknown;
            }).catch((error) => {
                return unknown;
            });
    }

    private static GetUnixArchitecture(): Promise<string> {
        return util.execChildProcess('uname -m')
            .then(architecture => {
                if (architecture) {
                    return architecture.trim();
                }

                return null;
            });
    }

    public hasCoreClrFlavor(): boolean {
        return this.getCoreClrFlavor() !== CoreClrFlavor.None;
    }

    public getCoreClrFlavor(): CoreClrFlavor {
        switch (this.operatingSystem) {
            case OperatingSystem.Windows: return CoreClrFlavor.Windows;
            case OperatingSystem.MacOS: return CoreClrFlavor.OSX;
            case OperatingSystem.Linux:
                const distro = this.distribution;
                switch (distro.name) {
                    case 'ubuntu':
                        if (distro.version.startsWith("14")) {
                            // This also works for Linux Mint
                            return CoreClrFlavor.Ubuntu14;
                        }
                        else if (distro.version.startsWith("16")) {
                            return CoreClrFlavor.Ubuntu16;
                        }

                        break;
                    case 'centos':
                        return CoreClrFlavor.CentOS;
                    case 'fedora':
                        return CoreClrFlavor.Fedora;
                    case 'opensuse':
                        return CoreClrFlavor.OpenSUSE;
                    case 'rhel':
                        return CoreClrFlavor.RHEL;
                    case 'debian':
                        return CoreClrFlavor.Debian;
                    case 'ol':
                        // Oracle Linux is binary compatible with CentOS
                        return CoreClrFlavor.CentOS;
                    case 'elementary':
                    case 'elementary OS':
                        if (distro.version.startsWith("0.3")) {
                            // Elementary OS 0.3 Freya is binary compatible with Ubuntu 14.04
                            return CoreClrFlavor.Ubuntu14;
                        }
                        else if (distro.version.startsWith("0.4")) {
                            // Elementary OS 0.4 Loki is binary compatible with Ubuntu 16.04
                            return CoreClrFlavor.Ubuntu16;
                        }

                        break;
                    case 'linuxmint':
                        if (distro.version.startsWith("18")) {
                            // Linux Mint 18 is binary compatible with Ubuntu 16.04
                            return CoreClrFlavor.Ubuntu16;
                        }

                        break;
                }
        }

        return CoreClrFlavor.None;
    }
}
