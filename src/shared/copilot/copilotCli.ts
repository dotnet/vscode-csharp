/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChildProcess, spawn } from 'child_process';
import { constants, promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { stripVTControlCharacters } from 'util';

export type CopilotCliSource = 'standalone' | 'app';

export interface CopilotCli {
    command: string;
    args: readonly string[];
    source: CopilotCliSource;
}

export interface CopilotPlugin {
    name: string;
    enabled: boolean;
    kind: 'installed' | 'builtin' | 'external';
}

function namedError(name: string, message: string, cause?: unknown): Error {
    return Object.assign(new Error(message, { cause }), { name });
}

function isMissing(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    return code === 'ENOENT' || code === 'ENOTDIR';
}

async function fileExists(file: string, signal: AbortSignal, executable = false): Promise<boolean> {
    signal.throwIfAborted();
    try {
        const stat = await fs.stat(file);
        signal.throwIfAborted();
        if (!stat.isFile()) {
            return false;
        }
        if (executable && os.platform() !== 'win32') {
            await fs.access(file, constants.X_OK);
            signal.throwIfAborted();
        }
        return true;
    } catch (error) {
        signal.throwIfAborted();
        if (isMissing(error)) {
            return false;
        }
        throw error;
    }
}

async function readMetadata(file: string, signal: AbortSignal): Promise<string | undefined> {
    signal.throwIfAborted();
    try {
        const text = await fs.readFile(file, 'utf8');
        signal.throwIfAborted();
        return text;
    } catch (error) {
        signal.throwIfAborted();
        if (isMissing(error)) {
            return undefined;
        }
        throw error;
    }
}

function environment(name: string): string | undefined {
    if (os.platform() !== 'win32') {
        return process.env[name];
    }
    const key = Object.keys(process.env).find((key) => key.toLowerCase() === name.toLowerCase());
    return key ? process.env[key] : undefined;
}

function platformPath(): typeof path.win32 {
    return os.platform() === 'win32' ? path.win32 : path.posix;
}

function absolute(value: string | undefined): value is string {
    if (!value || !platformPath().isAbsolute(value)) {
        return false;
    }
    // A Windows rooted path without a drive still depends on the current drive.
    return os.platform() !== 'win32' || /^[a-z]:[\\/]|^[\\/]{2}[^\\/]+[\\/][^\\/]+/i.test(value);
}

function environmentPath(name: string): string | undefined {
    const value = environment(name);
    return absolute(value) ? value : undefined;
}

function pathDirectories(): string[] {
    return (environment('PATH') ?? '')
        .split(platformPath().delimiter)
        .map((directory) => directory.trim().replace(/^"(.*)"$/, '$1'))
        .filter(absolute);
}

async function npmCli(
    directory: string,
    directories: readonly string[],
    signal: AbortSignal
): Promise<CopilotCli | undefined> {
    const p = platformPath();
    const packageDirectory = p.join(directory, 'node_modules', '@github', 'copilot');
    const metadata = await readMetadata(p.join(packageDirectory, 'package.json'), signal);
    if (metadata === undefined) {
        return undefined;
    }
    const packageJson = JSON.parse(metadata);
    const launcher = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.copilot;
    if (packageJson.name !== '@github/copilot' || typeof launcher !== 'string') {
        throw namedError('CopilotCliMetadataError', `Invalid Copilot npm package metadata in ${packageDirectory}`);
    }
    const launcherPath = p.resolve(packageDirectory, launcher);
    const relativeLauncher = p.relative(packageDirectory, launcherPath);
    if (relativeLauncher.startsWith('..') || p.isAbsolute(relativeLauncher) || !/\.[cm]?js$/i.test(launcherPath)) {
        throw namedError('CopilotCliMetadataError', `Invalid Copilot npm launcher in ${packageDirectory}`);
    }
    if (!(await fileExists(launcherPath, signal))) {
        return undefined;
    }

    // npm may keep optional packages nested or hoist them beside @github/copilot.
    const nativeName = `copilot-win32-${os.arch()}`;
    const nativeVersion = packageJson.optionalDependencies?.[`@github/${nativeName}`];
    if (typeof nativeVersion === 'string') {
        for (const root of [p.join(packageDirectory, 'node_modules', '@github'), p.dirname(packageDirectory)]) {
            const nativeDirectory = p.join(root, nativeName);
            const nativeMetadata = await readMetadata(p.join(nativeDirectory, 'package.json'), signal);
            if (nativeMetadata === undefined) {
                continue;
            }
            const nativePackage = JSON.parse(nativeMetadata);
            if (nativePackage.name !== `@github/${nativeName}` || nativePackage.version !== nativeVersion) {
                throw namedError(
                    'CopilotCliMetadataError',
                    `Mismatched Copilot native npm package in ${nativeDirectory}`
                );
            }
            const command = p.join(nativeDirectory, 'copilot.exe');
            if (await fileExists(command, signal, true)) {
                return { command, args: [], source: 'standalone' };
            }
        }
    }
    for (const nodeDirectory of new Set([directory, ...directories])) {
        const node = p.join(nodeDirectory, 'node.exe');
        if (await fileExists(node, signal, true)) {
            return { command: node, args: [launcherPath], source: 'standalone' };
        }
    }
    return undefined;
}

export async function findCopilotCli(signal: AbortSignal): Promise<CopilotCli | undefined> {
    signal.throwIfAborted();
    const p = platformPath();
    const platform = os.platform();
    const home = os.homedir();
    const directories = pathDirectories();
    const standaloneDirectories = [...directories, p.join(home, '.local', 'bin')];
    if (platform === 'win32') {
        const appData = environmentPath('APPDATA');
        if (appData) {
            standaloneDirectories.push(p.join(appData, 'npm'));
        }
        for (const root of [environmentPath('LOCALAPPDATA'), environmentPath('ProgramFiles')]) {
            if (root) {
                const winget =
                    root === environmentPath('LOCALAPPDATA')
                        ? p.join(root, 'Microsoft', 'WinGet')
                        : p.join(root, 'WinGet');
                standaloneDirectories.push(
                    p.join(winget, 'Links'),
                    p.join(winget, 'Packages', 'GitHub.Copilot_Microsoft.Winget.Source_8wekyb3d8bbwe')
                );
            }
        }
    } else {
        standaloneDirectories.push('/usr/local/bin', '/usr/bin');
        if (platform === 'darwin') {
            standaloneDirectories.push('/opt/homebrew/bin');
        }
    }
    for (const directory of new Set(standaloneDirectories.filter(absolute))) {
        const command = p.join(directory, platform === 'win32' ? 'copilot.exe' : 'copilot');
        if (await fileExists(command, signal, true)) {
            return { command, args: [], source: 'standalone' };
        }
        if (platform === 'win32') {
            for (const shim of ['copilot.cmd', 'copilot.ps1', 'copilot']) {
                if (await fileExists(p.join(directory, shim), signal)) {
                    const cli = await npmCli(directory, directories, signal);
                    if (cli) {
                        return cli;
                    }
                    break;
                }
            }
        }
    }

    const apps: { executable: string; resources: string }[] = [];
    let cache: string | undefined;
    if (platform === 'win32') {
        const local = environmentPath('LOCALAPPDATA');
        cache = local;
        const appDirectories = [
            ...(local ? [p.join(local, 'Programs', 'GitHub Copilot')] : []),
            ...['ProgramFiles', 'ProgramFiles(x86)']
                .map(environmentPath)
                .filter((root): root is string => root !== undefined)
                .map((root) => p.join(root, 'GitHub Copilot')),
            ...directories,
        ];
        for (const root of new Set(appDirectories)) {
            apps.push({ executable: p.join(root, 'github.exe'), resources: root });
        }
    } else if (platform === 'darwin') {
        cache = p.join(home, 'Library', 'Caches');
        for (const root of ['/Applications', p.join(home, 'Applications')]) {
            const contents = p.join(root, 'GitHub Copilot.app', 'Contents');
            apps.push({ executable: p.join(contents, 'MacOS', 'github'), resources: p.join(contents, 'Resources') });
        }
    } else if (platform === 'linux') {
        cache = environmentPath('XDG_CACHE_HOME') ?? p.join(home, '.cache');
        // Tauri deb/rpm resources use productName, including its spaces. An extracted
        // AppImage's usr/bin + usr/lib layout also works when usr/bin is on PATH.
        for (const bin of new Set(['/usr/bin', '/usr/local/bin', ...directories])) {
            apps.push({
                executable: p.join(bin, 'github'),
                resources: p.join(p.dirname(bin), 'lib', 'GitHub Copilot'),
            });
        }
    }
    if (!cache || !absolute(cache)) {
        return undefined;
    }
    for (const app of apps) {
        if (!(await fileExists(app.executable, signal, true))) {
            continue;
        }
        const metadataPath = p.join(app.resources, 'copilot-sdk', 'cliVersion.d.ts');
        const metadata = await readMetadata(metadataPath, signal);
        if (metadata === undefined) {
            continue;
        }
        const matches = [...metadata.matchAll(/export declare const COPILOT_CLI_VERSION\s*=\s*"([^"]+)";/g)];
        const version = matches[0]?.[1];
        if (matches.length !== 1 || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(version)) {
            throw namedError('CopilotCliMetadataError', `Invalid pinned Copilot CLI version in ${metadataPath}`);
        }
        const command = p.join(
            cache,
            'github-copilot-sdk',
            'cli',
            version.replace(/[^a-zA-Z0-9._-]/g, '_'),
            platform === 'win32' ? 'copilot.exe' : 'copilot'
        );
        if (await fileExists(command, signal, true)) {
            return { command, args: [], source: 'app' };
        }
    }
    signal.throwIfAborted();
    return undefined;
}

const maxOutputBytes = 1024 * 1024;

async function terminateProcessTree(child: ChildProcess): Promise<void> {
    if (child.pid === undefined) {
        return;
    }
    if (os.platform() !== 'win32') {
        try {
            process.kill(-child.pid, 'SIGKILL');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
                throw error;
            }
        }
        return;
    }
    const systemRoot = environmentPath('SystemRoot') ?? 'C:\\Windows';
    await new Promise<void>((resolve, reject) => {
        // Killing only the CLI leaves Git children running. /T is scoped to our PID;
        // do not kill the root first, or taskkill can no longer discover its children.
        const killer = spawn(
            path.win32.join(systemRoot, 'System32', 'taskkill.exe'),
            ['/PID', String(child.pid), '/T', '/F'],
            {
                windowsHide: true,
                shell: false,
                cwd: os.homedir(),
                env: process.env,
                stdio: ['ignore', 'ignore', 'pipe'],
            }
        );
        let error: Error | undefined;
        let stderr = '';
        killer.stderr?.on('data', (data: Buffer) => {
            stderr = (stderr + data.toString()).slice(0, 4096);
        });
        killer.on('error', (failure: Error) => {
            error = failure;
        });
        killer.on('close', (code) => {
            if (error) {
                reject(error);
            } else if (code !== 0) {
                reject(namedError('CopilotCliTerminationError', `taskkill exited with code ${code}: ${stderr}`));
            } else {
                resolve();
            }
        });
    });
}

export async function runCopilotCli(cli: CopilotCli, args: readonly string[], signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    return new Promise<string>((resolve, reject) => {
        const child = spawn(cli.command, [...cli.args, ...args], {
            windowsHide: true,
            shell: false,
            cwd: os.homedir(),
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
            // A private POSIX process group lets cancellation include spawned Git work.
            // The child stays referenced and is always awaited; it is not a background job.
            detached: os.platform() !== 'win32',
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let bytes = 0;
        let failure: Error | undefined;
        let termination: Promise<void> | undefined;
        const stop = (error: Error) => {
            failure ??= error;
            termination ??= terminateProcessTree(child).catch((terminationError) => {
                failure = namedError(
                    'CopilotCliTerminationError',
                    'Could not terminate the Copilot CLI process tree',
                    new AggregateError([failure, terminationError])
                );
                // Still wait for the owned child to exit even if tree termination fails.
                try {
                    child.kill('SIGKILL');
                } catch (killError) {
                    failure = namedError(
                        'CopilotCliTerminationError',
                        'Could not terminate the Copilot CLI process',
                        new AggregateError([failure, killError])
                    );
                }
            });
        };
        const onAbort = () =>
            stop(
                signal.reason instanceof Error
                    ? signal.reason
                    : namedError('AbortError', 'Copilot CLI operation cancelled', signal.reason)
            );
        const capture = (buffers: Buffer[], data: Buffer | string) => {
            if (failure) {
                return;
            }
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
            bytes += buffer.length;
            if (bytes > maxOutputBytes) {
                stop(namedError('CopilotCliOutputLimitError', `Copilot CLI output exceeded ${maxOutputBytes} bytes`));
            } else {
                buffers.push(buffer);
            }
        };
        child.stdout?.on('data', (data: Buffer) => capture(stdout, data));
        child.stderr?.on('data', (data: Buffer) => capture(stderr, data));
        child.on('error', (error: Error) => {
            failure ??= error;
        });
        child.on('close', (code, exitSignal) => {
            signal.removeEventListener('abort', onAbort);
            // close includes pipe closure; also wait for taskkill itself before releasing
            // the caller's gate, otherwise a second install can race tree termination.
            void (async () => {
                await termination;
                if (failure) {
                    reject(failure);
                } else if (code !== 0) {
                    reject(
                        namedError(
                            'CopilotCliProcessError',
                            `Copilot CLI exited with code ${code}, signal ${exitSignal}: ${Buffer.concat(stderr).toString('utf8')}`
                        )
                    );
                } else {
                    resolve(Buffer.concat(stdout).toString('utf8'));
                }
            })();
        });
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) {
            onAbort();
        }
    });
}

export function parsePluginList(output: string): CopilotPlugin[] {
    const lines = stripVTControlCharacters(output).split(/\r?\n/);
    const plugins: CopilotPlugin[] = [];
    const sections = new Set<CopilotPlugin['kind']>();
    let section: CopilotPlugin['kind'] | undefined;
    let sectionCount = 0;
    let explicitlyEmpty = false;
    let installHint = false;
    const invalid = () =>
        namedError('CopilotPluginInventoryError', 'Unrecognized or incomplete Copilot plugin inventory');
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) {
            continue;
        }
        if (line === 'No plugins installed.') {
            if (explicitlyEmpty || sections.has('installed')) {
                throw invalid();
            }
            explicitlyEmpty = true;
            continue;
        }
        if (line === "Use 'copilot plugin install <source>' to install a plugin.") {
            if (!explicitlyEmpty || installHint) {
                throw invalid();
            }
            installHint = true;
            continue;
        }
        const heading: CopilotPlugin['kind'] | undefined = /^Installed plugins:$/i.test(line)
            ? 'installed'
            : /^Built-in Plugins \(bundled with the CLI\):$/i.test(line)
              ? 'builtin'
              : /^External Plugins \(via --plugin-dir\):$/i.test(line)
                ? 'external'
                : undefined;
        if (heading) {
            if (
                (section && sectionCount === 0) ||
                sections.has(heading) ||
                (heading === 'installed' && explicitlyEmpty)
            ) {
                throw invalid();
            }
            section = heading;
            sectionCount = 0;
            sections.add(heading);
            continue;
        }
        const entry =
            /^\s+• ([a-zA-Z0-9][a-zA-Z0-9._-]*(?:@[a-zA-Z0-9][a-zA-Z0-9._-]*)?)(?: \(v\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?\))?( \[disabled\])?$/.exec(
                raw
            );
        if (!section || !entry || plugins.some((plugin) => plugin.kind === section && plugin.name === entry[1])) {
            throw invalid();
        }
        plugins.push({ name: entry[1], enabled: !entry[2], kind: section });
        sectionCount++;
    }
    if ((!explicitlyEmpty && !sections.has('installed')) || (section && sectionCount === 0)) {
        throw invalid();
    }
    return plugins;
}
