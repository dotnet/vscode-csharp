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
    public constructor(
        public name: string,
        public version: string,
        public idLike?: string[]) { }

    public static GetCurrent(): Promise<LinuxDistribution> {
        // Try /etc/os-release and fallback to /usr/lib/os-release per the synopsis
        // at https://www.freedesktop.org/software/systemd/man/os-release.html.
        return LinuxDistribution.FromFilePath('/etc/os-release')
            .catch(() => LinuxDistribution.FromFilePath('/usr/lib/os-release'))
            .catch(() => Promise.resolve(new LinuxDistribution(unknown, unknown)));
    }

    public toString(): string {
        return `name=${this.name}, version=${this.version}`;
    }

    /**
     * Returns a string representation of LinuxDistribution that only returns the
     * distro name if it appears on an approved list of known distros. Otherwise,
     * it returns 'other'.
     */
    public toTelemetryString(): string {
        const approvedList = [
            'antergos', 'arch', 'centos', 'debian', 'deepin', 'elementary', 'fedora',
            'galliumos', 'gentoo', 'kali', 'linuxmint', 'manjoro', 'neon', 'opensuse',
            'parrot', 'rhel', 'ubuntu', 'zorin'
        ];

        if (this.name === unknown || approvedList.indexOf(this.name) >= 0) {
            return this.toString();
        }
        else {
            return 'other';
        }
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

    public static FromReleaseInfo(releaseInfo: string, eol: string = os.EOL): LinuxDistribution {
        let name = unknown;
        let version = unknown;
        let idLike : string[] = null;

        const lines = releaseInfo.split(eol);
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
                else if (key === 'ID_LIKE') {
                    idLike = value.split(" ");
                }

                if (name !== unknown && version !== unknown && idLike !== null) {
                    break;
                }
            }
        }

        return new LinuxDistribution(name, version, idLike);
    }
}

export class PlatformInformation {
    public constructor(
        public platform: string,
        public architecture: string,
        public distribution: LinuxDistribution = null)
    {
    }

    public isWindows(): boolean {
        return this.platform === 'win32';
    }

    public isMacOS(): boolean {
        return this.platform === 'darwin';
    }

    public isLinux(): boolean {
        return this.platform === 'linux';
    }

    public toString(): string {
        let result = this.platform;

        if (this.architecture) {
            if (result) {
                result += ', ';
            }

            result += this.architecture;
        }

        if (this.distribution) {
            if (result) {
                result += ', ';
            }

            result += this.distribution.toString();
        }

        return result;
    }

    public static GetCurrent(): Promise<PlatformInformation> {
        let platform = os.platform();
        let architecturePromise: Promise<string>;
        let distributionPromise: Promise<LinuxDistribution>;

        switch (platform) {
            case 'win32':
                architecturePromise = PlatformInformation.GetWindowsArchitecture();
                distributionPromise = Promise.resolve(null);
                break;

            case 'darwin':
                architecturePromise = PlatformInformation.GetUnixArchitecture();
                distributionPromise = Promise.resolve(null);
                break;

            case 'linux':
                architecturePromise = PlatformInformation.GetUnixArchitecture();
                distributionPromise = LinuxDistribution.GetCurrent();
                break;

            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }

        return Promise.all<any>([architecturePromise, distributionPromise])
            .then(([arch, distro]) => {
                return new PlatformInformation(platform, arch, distro);
            });
    }

    private static GetWindowsArchitecture(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (process.env.PROCESSOR_ARCHITECTURE === 'x86' && process.env.PROCESSOR_ARCHITEW6432 === undefined) {
                resolve('x86');
            }
            else {
                resolve('x86_64');
            }
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
}
