/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as util from '../common';

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
        public version: string) { }

    public static async GetCurrent(): Promise<LinuxDistribution> {
        // Try /etc/os-release and fallback to /usr/lib/os-release per the synopsis
        // at https://www.freedesktop.org/software/systemd/man/os-release.html.
        return LinuxDistribution.FromFilePath('/etc/os-release')
            .catch(async () => LinuxDistribution.FromFilePath('/usr/lib/os-release'))
            .catch(async () => Promise.resolve(new LinuxDistribution(unknown, unknown)));
    }

    public toString(): string {
        return `name=${this.name}, version=${this.version}`;
    }

    /**
     * Returns a string representation of LinuxDistribution that only returns the
     * distro name if it appears on an allowed list of known distros. Otherwise,
     * it returns 'other'.
     */
    public toTelemetryString(): string {
        const allowedList = [
            'alpine', 'antergos', 'arch', 'centos', 'debian', 'deepin', 'elementary',
            'fedora', 'galliumos', 'gentoo', 'kali', 'linuxmint', 'manjoro', 'neon',
            'opensuse', 'parrot', 'rhel', 'ubuntu', 'zorin'
        ];

        if (this.name === unknown || allowedList.indexOf(this.name) >= 0) {
            return this.toString();
        }
        else {
            // Having a hash of the name will be helpful to identify spikes in the 'other'
            // bucket when a new distro becomes popular and needs to be added to the
            // allowed list above.
            const hash = crypto.createHash('sha256');
            hash.update(this.name);

            const hashedName = hash.digest('hex');

            return `other (${hashedName})`;
        }
    }

    private static async FromFilePath(filePath: string): Promise<LinuxDistribution> {
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

                if (name !== unknown && version !== unknown) {
                    break;
                }
            }
        }

        return new LinuxDistribution(name, version);
    }
}

export class PlatformInformation {
    public constructor(
        public platform: string,
        public architecture: string,
        public distribution?: LinuxDistribution) {
    }

    public isWindows(): boolean {
        return this.platform === 'win32';
    }

    public isMacOS(): boolean {
        return this.platform === 'darwin';
    }

    public isLinux(): boolean {
        return this.platform.startsWith('linux');
    }

    public toString(): string {
        let result = `${this.platform}, ${this.architecture}`;
        if (this.distribution !== undefined) {
            result += `, ${this.distribution.toString()}`;
        }

        return result;
    }

    public static async GetCurrent(): Promise<PlatformInformation> {
        const platform = os.platform();
        if (platform === 'win32') {
            return new PlatformInformation(platform, PlatformInformation.GetWindowsArchitecture());
        }
        else if (platform === 'darwin') {
            return new PlatformInformation(platform, await PlatformInformation.GetUnixArchitecture());
        }
        else if (platform === 'linux') {
            const [isMusl, architecture, distribution] = await Promise.all([
                PlatformInformation.GetIsMusl(),
                PlatformInformation.GetUnixArchitecture(),
                LinuxDistribution.GetCurrent()
            ]);
            return new PlatformInformation(isMusl ? 'linux-musl' : platform, architecture, distribution);
        }

        throw new Error(`Unsupported platform: ${platform}`);
    }

    private static GetWindowsArchitecture(): string {
        if (process.env.PROCESSOR_ARCHITECTURE === 'x86' && process.env.PROCESSOR_ARCHITEW6432 === undefined) {
            return 'x86';
        }
        else if (process.env.PROCESSOR_ARCHITECTURE === 'ARM64' && process.env.PROCESSOR_ARCHITEW6432 === undefined) {
            return 'arm64';
        }
        else {
            return 'x86_64';
        }
    }

    private static async GetUnixArchitecture(): Promise<string> {
        const architecture = (await util.execChildProcess('uname -m')).trim();
        if (architecture === "aarch64") {
            return "arm64";
        }
        return architecture;
    }

    // Emulates https://github.com/dotnet/install-scripts/blob/3c6cc06/src/dotnet-install.sh#L187-L189.
    private static async GetIsMusl(): Promise<boolean> {
        try {
            const output = await util.execChildProcess('ldd --version');
            return output.includes('musl');
        } catch (err) {
            return err instanceof Error ? err.message.includes('musl') : false;
        }
    }

    public isValidPlatformForMono(): boolean {
        return this.isLinux() || this.isMacOS();
    }
}
