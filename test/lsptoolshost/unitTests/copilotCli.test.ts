/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { ChildProcess, spawn, SpawnOptions } from 'child_process';
import { EventEmitter } from 'events';
import { promises as fs, PathLike, Stats } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import { CopilotCli, findCopilotCli, parsePluginList, runCopilotCli } from '../../../src/shared/copilot/copilotCli';

jest.mock('fs', () => ({
    ...jest.requireActual<typeof import('fs')>('fs'),
    promises: { stat: jest.fn(), readFile: jest.fn(), access: jest.fn() },
}));
jest.mock('os', () => ({
    ...jest.requireActual<typeof import('os')>('os'),
    platform: jest.fn(),
    arch: jest.fn(),
    homedir: jest.fn(),
}));
jest.mock('child_process', () => ({ spawn: jest.fn() }));

const files = new Map<string, string>();
const errors = new Map<string, Error>();
const stat = jest.mocked<(file: PathLike) => Promise<Stats>>(fs.stat);
const readFile = jest.mocked<(file: PathLike, encoding: 'utf8') => Promise<string>>(fs.readFile);
const access = jest.mocked(fs.access);
const spawnMock = jest.mocked<(command: string, args: readonly string[], options: SpawnOptions) => ChildProcess>(spawn);
const home = 'C:\\Users\\fixture';
const local = `${home}\\AppData\\Local`;
const roaming = `${home}\\AppData\\Roaming`;
const signal = () => new AbortController().signal;
const runtime: CopilotCli = { command: 'C:\\Tools\\copilot.exe', args: [], source: 'standalone' };

function missing(file: string): Error {
    return Object.assign(new Error(`Missing fixture: ${file}`), { code: 'ENOENT' });
}

function addFile(file: string, content = ''): void {
    files.set(file, content);
}

function setPlatform(platform: NodeJS.Platform): void {
    jest.mocked(os.platform).mockReturnValue(platform);
    jest.mocked(os.homedir).mockReturnValue(platform === 'win32' ? home : '/home/fixture');
}

function appFixture(platform: NodeJS.Platform, version = '1.0.83'): string {
    setPlatform(platform);
    const p = platform === 'win32' ? path.win32 : path.posix;
    const root =
        platform === 'win32'
            ? `${local}\\Programs\\GitHub Copilot`
            : platform === 'darwin'
              ? '/Applications/GitHub Copilot.app/Contents'
              : '/usr/lib/GitHub Copilot';
    addFile(
        platform === 'win32'
            ? p.join(root, 'github.exe')
            : platform === 'darwin'
              ? p.join(root, 'MacOS', 'github')
              : '/usr/bin/github'
    );
    const metadata = p.join(platform === 'darwin' ? p.join(root, 'Resources') : root, 'copilot-sdk', 'cliVersion.d.ts');
    addFile(
        metadata,
        `export declare const COPILOT_CLI_VERSION = "${version}";\nexport declare const COPILOT_CLI_USE_NPM_PACKAGE = false;`
    );
    const cache =
        platform === 'win32' ? local : platform === 'darwin' ? '/home/fixture/Library/Caches' : '/home/fixture/.cache';
    const command = p.join(
        cache,
        'github-copilot-sdk',
        'cli',
        version.replace(/\+/g, '_'),
        platform === 'win32' ? 'copilot.exe' : 'copilot'
    );
    addFile(command);
    return command;
}

function npmFixture(options: { native?: 'nested' | 'hoisted'; arch?: string; shim?: string } = {}): {
    directory: string;
    launcher: string;
    native: string;
} {
    const directory = `${roaming}\\npm`;
    const packageDirectory = `${directory}\\node_modules\\@github\\copilot`;
    const nativeName = `copilot-win32-${options.arch ?? 'x64'}`;
    addFile(`${directory}\\${options.shim ?? 'copilot.cmd'}`);
    addFile(
        `${packageDirectory}\\package.json`,
        JSON.stringify({
            name: '@github/copilot',
            version: '1.0.83',
            bin: { copilot: 'npm-loader.js' },
            optionalDependencies: { [`@github/${nativeName}`]: '1.0.83' },
        })
    );
    const launcher = `${packageDirectory}\\npm-loader.js`;
    addFile(launcher);
    const nativeDirectory =
        options.native === 'hoisted'
            ? `${directory}\\node_modules\\@github\\${nativeName}`
            : `${packageDirectory}\\node_modules\\@github\\${nativeName}`;
    const native = `${nativeDirectory}\\copilot.exe`;
    if (options.native) {
        addFile(
            `${nativeDirectory}\\package.json`,
            JSON.stringify({ name: `@github/${nativeName}`, version: '1.0.83' })
        );
        addFile(native);
    }
    return { directory, launcher, native };
}

function childFixture(pid: number | undefined = 4101): ChildProcess {
    return Object.assign(new EventEmitter(), {
        pid,
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        stdin: null,
        kill: jest.fn(() => true),
    }) as unknown as ChildProcess;
}

async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

beforeEach(() => {
    jest.resetAllMocks();
    jest.replaceProperty(process, 'env', {
        PATH: '',
        LOCALAPPDATA: local,
        APPDATA: roaming,
        ProgramFiles: 'C:\\Program Files',
        SystemRoot: 'C:\\Windows',
        COPILOT_HOME: 'C:\\Copilot Home',
    });
    jest.spyOn(process, 'kill').mockReturnValue(true);
    setPlatform('win32');
    jest.mocked(os.arch).mockReturnValue('x64');
    files.clear();
    errors.clear();
    stat.mockImplementation(async (file) => {
        const name = String(file);
        if (errors.has(name)) {
            throw errors.get(name);
        }
        if (!files.has(name)) {
            throw missing(name);
        }
        return { isFile: () => true } as Stats;
    });
    readFile.mockImplementation(async (file) => {
        const name = String(file);
        if (errors.has(name)) {
            throw errors.get(name);
        }
        const content = files.get(name);
        if (content === undefined) {
            throw missing(name);
        }
        return content;
    });
    access.mockResolvedValue(undefined);
});

afterEach(() => {
    expect(spawnMock).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ shell: true })
    );
    jest.restoreAllMocks();
});

describe('Copilot CLI filesystem discovery', () => {
    test('prefers the first standalone PATH CLI, even when an app is installed', async () => {
        appFixture('win32');
        process.env.PATH = 'C:\\First;C:\\Second';
        addFile('C:\\First\\copilot.exe');
        addFile('C:\\Second\\copilot.exe');
        await expect(findCopilotCli(signal())).resolves.toEqual({
            command: 'C:\\First\\copilot.exe',
            args: [],
            source: 'standalone',
        });
        expect(readFile).not.toHaveBeenCalled();
        expect(spawnMock).not.toHaveBeenCalled();
    });

    test('ignores empty, relative, drive-relative, and current-drive PATH entries', async () => {
        process.env.PATH = ';.;tools;C:tools;\\tools;;"C:\\Absolute Tools"';
        addFile('C:\\Absolute Tools\\copilot.exe');
        await expect(findCopilotCli(signal())).resolves.toMatchObject({ command: 'C:\\Absolute Tools\\copilot.exe' });
        expect(stat.mock.calls.map((call) => String(call[0]))).toEqual(['C:\\Absolute Tools\\copilot.exe']);
    });

    test('handles case-insensitive Windows Path and environment variable names', async () => {
        delete process.env.PATH;
        process.env.Path = 'C:\\Tools';
        addFile(runtime.command);
        await expect(findCopilotCli(signal())).resolves.toEqual(runtime);
    });

    test.each(['nested', 'hoisted'] as const)(
        'uses the %s npm native package instead of executing a cmd shim',
        async (native) => {
            const fixture = npmFixture({ native });
            await expect(findCopilotCli(signal())).resolves.toEqual({
                command: fixture.native,
                args: [],
                source: 'standalone',
            });
            expect(spawnMock).not.toHaveBeenCalled();
        }
    );

    test('resolves an arm64 native package behind a PowerShell shim', async () => {
        jest.mocked(os.arch).mockReturnValue('arm64');
        const fixture = npmFixture({ native: 'nested', arch: 'arm64', shim: 'copilot.ps1' });
        await expect(findCopilotCli(signal())).resolves.toMatchObject({ command: fixture.native });
    });

    test('uses an absolute Node executable and the actual npm launcher without a native package', async () => {
        const fixture = npmFixture();
        process.env.PATH = 'relative;;C:\\Node';
        addFile('C:\\Node\\node.exe');
        await expect(findCopilotCli(signal())).resolves.toEqual({
            command: 'C:\\Node\\node.exe',
            args: [fixture.launcher],
            source: 'standalone',
        });
    });

    test('prefers node.exe adjacent to the npm shim', async () => {
        const fixture = npmFixture();
        process.env.PATH = 'C:\\OtherNode';
        addFile('C:\\OtherNode\\node.exe');
        addFile(`${fixture.directory}\\node.exe`);
        await expect(findCopilotCli(signal())).resolves.toMatchObject({
            command: `${fixture.directory}\\node.exe`,
            args: [fixture.launcher],
        });
    });

    test('does not mistake an arbitrary cmd file for a usable CLI', async () => {
        process.env.PATH = 'C:\\Tools';
        addFile('C:\\Tools\\copilot.cmd');
        await expect(findCopilotCli(signal())).resolves.toBeUndefined();
        expect(spawnMock).not.toHaveBeenCalled();
    });

    test('does not run an npm shim without a native package or an absolute Node runtime', async () => {
        npmFixture();
        await expect(findCopilotCli(signal())).resolves.toBeUndefined();
    });

    test('rejects an npm launcher that escapes its package', async () => {
        const fixture = npmFixture();
        const metadata = `${fixture.directory}\\node_modules\\@github\\copilot\\package.json`;
        addFile(metadata, JSON.stringify({ name: '@github/copilot', bin: { copilot: '..\\evil.js' } }));
        await expect(findCopilotCli(signal())).rejects.toMatchObject({ name: 'CopilotCliMetadataError' });
    });

    test('surfaces malformed and mismatched npm metadata', async () => {
        const fixture = npmFixture({ native: 'nested' });
        addFile(
            path.win32.join(path.win32.dirname(fixture.native), 'package.json'),
            '{"name":"wrong","version":"9.0.0"}'
        );
        await expect(findCopilotCli(signal())).rejects.toMatchObject({ name: 'CopilotCliMetadataError' });
        addFile(`${fixture.directory}\\node_modules\\@github\\copilot\\package.json`, '{');
        await expect(findCopilotCli(signal())).rejects.toBeInstanceOf(SyntaxError);
    });

    test('supports the default WinGet package location without PATH', async () => {
        const command = `${local}\\Microsoft\\WinGet\\Packages\\GitHub.Copilot_Microsoft.Winget.Source_8wekyb3d8bbwe\\copilot.exe`;
        addFile(command);
        await expect(findCopilotCli(signal())).resolves.toEqual({ command, args: [], source: 'standalone' });
    });

    test.each(['linux', 'darwin'] as const)(
        'supports executable POSIX native or script CLI paths on %s',
        async (platform) => {
            setPlatform(platform);
            process.env.PATH = ':.:relative:/opt/copilot/bin';
            addFile('/opt/copilot/bin/copilot', '#!/usr/bin/env node');
            await expect(findCopilotCli(signal())).resolves.toEqual({
                command: '/opt/copilot/bin/copilot',
                args: [],
                source: 'standalone',
            });
            expect(access).toHaveBeenCalledWith('/opt/copilot/bin/copilot', expect.any(Number));
            expect(spawnMock).not.toHaveBeenCalled();
        }
    );

    test('supports a trusted user-local POSIX install absent from PATH', async () => {
        setPlatform('linux');
        addFile('/home/fixture/.local/bin/copilot');
        await expect(findCopilotCli(signal())).resolves.toMatchObject({ command: '/home/fixture/.local/bin/copilot' });
    });

    test.each(['win32', 'darwin', 'linux'] as const)(
        'uses the installed app pin, not the newest cache on %s',
        async (platform) => {
            const command = appFixture(platform, '1.0.83');
            addFile(command.replace('1.0.83', '99.0.0'));
            await expect(findCopilotCli(signal())).resolves.toEqual({ command, args: [], source: 'app' });
            expect(spawnMock).not.toHaveBeenCalled();
        }
    );

    test('supports a user Applications macOS app', async () => {
        const command = appFixture('darwin');
        for (const [name, content] of [...files]) {
            if (name.startsWith('/Applications/')) {
                files.delete(name);
                addFile(name.replace('/Applications/', '/home/fixture/Applications/'), content);
            }
        }
        await expect(findCopilotCli(signal())).resolves.toMatchObject({ command, source: 'app' });
    });

    test('respects an absolute XDG cache home without reading COPILOT_HOME', async () => {
        const oldCommand = appFixture('linux');
        const command = oldCommand.replace('/home/fixture/.cache', '/custom/cache');
        files.delete(oldCommand);
        addFile(command);
        process.env.XDG_CACHE_HOME = '/custom/cache';
        await expect(findCopilotCli(signal())).resolves.toMatchObject({ command, source: 'app' });
        expect(readFile.mock.calls.map((call) => String(call[0]))).toEqual([
            '/usr/lib/GitHub Copilot/copilot-sdk/cliVersion.d.ts',
        ]);
    });

    test('ignores a relative XDG cache home', async () => {
        const command = appFixture('linux');
        process.env.XDG_CACHE_HOME = 'relative';
        await expect(findCopilotCli(signal())).resolves.toMatchObject({ command });
    });

    test('requires installed app evidence instead of accepting a stale extracted CLI cache', async () => {
        const command = appFixture('win32');
        files.delete(`${local}\\Programs\\GitHub Copilot\\github.exe`);
        await expect(findCopilotCli(signal())).resolves.toBeUndefined();
        expect(stat.mock.calls.map((call) => call[0])).not.toContain(command);
        expect(readFile).not.toHaveBeenCalled();
    });

    test('returns no CLI for an installed app that has not extracted its pinned runtime', async () => {
        const command = appFixture('win32');
        files.delete(command);
        addFile(command.replace('1.0.83', '99.0.0'));
        await expect(findCopilotCli(signal())).resolves.toBeUndefined();
    });

    test('returns no CLI for a layout without readable pin metadata', async () => {
        appFixture('win32');
        files.delete(`${local}\\Programs\\GitHub Copilot\\copilot-sdk\\cliVersion.d.ts`);
        await expect(findCopilotCli(signal())).resolves.toBeUndefined();
    });

    test('supports an all-users Windows application install', async () => {
        const command = appFixture('win32');
        for (const [name, content] of [...files]) {
            if (name.startsWith(`${local}\\Programs\\GitHub Copilot\\`)) {
                files.delete(name);
                addFile(name.replace(`${local}\\Programs`, 'C:\\Program Files'), content);
            }
        }
        await expect(findCopilotCli(signal())).resolves.toMatchObject({ command, source: 'app' });
    });

    test('supports an extracted Linux AppImage usr layout on an absolute PATH', async () => {
        const command = appFixture('linux');
        process.env.PATH = '/opt/copilot-app/usr/bin';
        for (const [name, content] of [...files]) {
            if (name.startsWith('/usr/')) {
                files.delete(name);
                addFile(`/opt/copilot-app${name}`, content);
            }
        }
        await expect(findCopilotCli(signal())).resolves.toMatchObject({ command, source: 'app' });
    });

    test.each(['../../other', '', 'latest', '1.0.83";\nexport declare const COPILOT_CLI_VERSION = "2.0.0'])(
        'rejects unsafe or ambiguous app version metadata %j',
        async (version) => {
            appFixture('win32');
            addFile(
                `${local}\\Programs\\GitHub Copilot\\copilot-sdk\\cliVersion.d.ts`,
                `export declare const COPILOT_CLI_VERSION = "${version}";`
            );
            await expect(findCopilotCli(signal())).rejects.toMatchObject({ name: 'CopilotCliMetadataError' });
        }
    );

    test.each(['ENOENT', 'ENOTDIR'])('treats %s as normal absence', async (code) => {
        process.env.PATH = 'C:\\Tools';
        errors.set(runtime.command, Object.assign(new Error('not present'), { code }));
        await expect(findCopilotCli(signal())).resolves.toBeUndefined();
    });

    test.each(['EACCES', 'EIO'])('preserves unexpected filesystem failure %s', async (code) => {
        process.env.PATH = 'C:\\Tools';
        const error = Object.assign(new Error('filesystem failed'), { code });
        errors.set(runtime.command, error);
        await expect(findCopilotCli(signal())).rejects.toBe(error);
    });

    test('preserves an executable-permission failure', async () => {
        setPlatform('linux');
        addFile('/home/fixture/.local/bin/copilot');
        const error = Object.assign(new Error('not executable'), { code: 'EACCES' });
        access.mockRejectedValueOnce(error);
        await expect(findCopilotCli(signal())).rejects.toBe(error);
    });

    test('does no filesystem work when already cancelled', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(findCopilotCli(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
        expect(stat).not.toHaveBeenCalled();
        expect(readFile).not.toHaveBeenCalled();
    });

    test('checks cancellation after a filesystem await before selecting a CLI', async () => {
        const controller = new AbortController();
        stat.mockImplementationOnce(async () => {
            controller.abort();
            return { isFile: () => true } as Stats;
        });
        await expect(findCopilotCli(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
        expect(stat).toHaveBeenCalledTimes(1);
    });

    test('checks cancellation after reading app metadata', async () => {
        appFixture('win32');
        const controller = new AbortController();
        readFile.mockImplementationOnce(async () => {
            controller.abort();
            return 'export declare const COPILOT_CLI_VERSION = "1.0.83";';
        });
        await expect(findCopilotCli(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    });
});

describe('Copilot CLI process execution', () => {
    test('uses an argument array, a neutral cwd, inherited environment, and closed stdin', async () => {
        const child = childFixture();
        spawnMock.mockReturnValue(child);
        const promise = runCopilotCli(
            { ...runtime, args: ['C:\\Package With Spaces\\npm-loader.js'] },
            ['plugin', 'install', 'owner/repo:path;literal'],
            signal()
        );
        expect(spawnMock).toHaveBeenCalledWith(
            runtime.command,
            ['C:\\Package With Spaces\\npm-loader.js', 'plugin', 'install', 'owner/repo:path;literal'],
            {
                cwd: home,
                env: process.env,
                windowsHide: true,
                shell: false,
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false,
            }
        );
        child.stdout!.emit('data', Buffer.from('installed\n'));
        child.stderr!.emit('data', Buffer.from('diagnostic'));
        child.emit('close', 0, null);
        await expect(promise).resolves.toBe('installed\n');
        expect(process.env.COPILOT_HOME).toBe('C:\\Copilot Home');
    });

    test('preserves UTF-8 characters split across stdout chunks', async () => {
        const child = childFixture();
        spawnMock.mockReturnValue(child);
        const promise = runCopilotCli(runtime, ['plugin', 'list'], signal());
        const data = Buffer.from('  • dotnet');
        child.stdout!.emit('data', data.subarray(0, 3));
        child.stdout!.emit('data', data.subarray(3));
        child.emit('close', 0, null);
        await expect(promise).resolves.toBe('  • dotnet');
    });

    test('rejects a nonzero exit with useful stderr and exit details', async () => {
        const child = childFixture();
        spawnMock.mockReturnValue(child);
        const promise = runCopilotCli(runtime, ['plugin', 'list'], signal());
        child.stderr!.emit('data', Buffer.from('permission denied'));
        child.emit('close', 7, null);
        await expect(promise).rejects.toMatchObject({
            name: 'CopilotCliProcessError',
            message: expect.stringContaining('7, signal null: permission denied'),
        });
    });

    test('rejects termination by a signal instead of treating it as successful empty output', async () => {
        const child = childFixture();
        spawnMock.mockReturnValue(child);
        const promise = runCopilotCli(runtime, ['plugin', 'list'], signal());
        child.emit('close', null, 'SIGTERM');
        await expect(promise).rejects.toMatchObject({
            name: 'CopilotCliProcessError',
            message: expect.stringContaining('SIGTERM'),
        });
    });

    test('preserves spawn failures and waits for close after error', async () => {
        const child = childFixture();
        Object.defineProperty(child, 'pid', { value: undefined });
        spawnMock.mockReturnValue(child);
        const error = Object.assign(new Error('cannot launch'), { code: 'ENOENT' });
        const promise = runCopilotCli(runtime, [], signal());
        const result = promise.then(
            () => 'resolved',
            (reason) => reason
        );
        let settled = false;
        void result.then(() => {
            settled = true;
        });
        child.emit('error', error);
        await flush();
        expect(settled).toBe(false);
        child.emit('close', -2, null);
        await expect(result).resolves.toBe(error);
    });

    test('preserves a synchronous spawn error', async () => {
        const error = new Error('spawn failed');
        spawnMock.mockImplementationOnce(() => {
            throw error;
        });
        await expect(runCopilotCli(runtime, [], signal())).rejects.toBe(error);
    });

    test('does not spawn for a pre-aborted operation', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(runCopilotCli(runtime, [], controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
        expect(spawnMock).not.toHaveBeenCalled();
    });

    test('catches cancellation occurring during spawn before the abort listener is registered', async () => {
        const child = childFixture();
        const killer = childFixture(4102);
        const controller = new AbortController();
        spawnMock
            .mockImplementationOnce(() => {
                controller.abort();
                return child;
            })
            .mockReturnValueOnce(killer);
        const result = runCopilotCli(runtime, [], controller.signal).catch((error) => error);
        expect(spawnMock).toHaveBeenCalledTimes(2);
        child.emit('close', 1, null);
        killer.emit('close', 0, null);
        await expect(result).resolves.toMatchObject({ name: 'AbortError' });
    });

    test('does not start taskkill when a failed spawn has no process ID', async () => {
        const child = childFixture();
        Object.defineProperty(child, 'pid', { value: undefined });
        spawnMock.mockReturnValue(child);
        const controller = new AbortController();
        const result = runCopilotCli(runtime, [], controller.signal).catch((error) => error);
        controller.abort();
        child.emit('error', missing(runtime.command));
        child.emit('close', -2, null);
        await expect(result).resolves.toMatchObject({ name: 'AbortError' });
        expect(spawnMock).toHaveBeenCalledTimes(1);
    });

    test.each(['child-first', 'killer-first'])(
        'waits for both CLI close and Windows tree termination (%s)',
        async (order) => {
            const child = childFixture();
            const killer = childFixture(4102);
            spawnMock.mockReturnValueOnce(child).mockReturnValueOnce(killer);
            const controller = new AbortController();
            const result = runCopilotCli(runtime, [], controller.signal).catch((error) => error);
            let settled = false;
            void result.then(() => {
                settled = true;
            });
            controller.abort();
            expect(spawnMock).toHaveBeenLastCalledWith(
                'C:\\Windows\\System32\\taskkill.exe',
                ['/PID', '4101', '/T', '/F'],
                expect.objectContaining({ shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
            );
            expect(child.kill).not.toHaveBeenCalled();
            (order === 'child-first' ? child : killer).emit('close', 0, null);
            await flush();
            expect(settled).toBe(false);
            (order === 'child-first' ? killer : child).emit('close', 0, null);
            await expect(result).resolves.toMatchObject({ name: 'AbortError' });
        }
    );

    test('uses a private POSIX process group to cancel CLI and Git descendants', async () => {
        setPlatform('linux');
        const child = childFixture();
        spawnMock.mockReturnValue(child);
        const controller = new AbortController();
        const result = runCopilotCli({ ...runtime, command: '/usr/bin/copilot' }, [], controller.signal).catch(
            (error) => error
        );
        controller.abort();
        expect(spawnMock).toHaveBeenCalledWith(
            '/usr/bin/copilot',
            [],
            expect.objectContaining({ detached: true, cwd: '/home/fixture' })
        );
        expect(process.kill).toHaveBeenCalledWith(-4101, 'SIGKILL');
        child.emit('close', null, 'SIGKILL');
        await expect(result).resolves.toMatchObject({ name: 'AbortError' });
    });

    test('tolerates an already-exited POSIX process group during cancellation', async () => {
        setPlatform('linux');
        const child = childFixture();
        spawnMock.mockReturnValue(child);
        jest.mocked(process.kill).mockImplementationOnce(() => {
            throw Object.assign(new Error('gone'), { code: 'ESRCH' });
        });
        const controller = new AbortController();
        const result = runCopilotCli(runtime, [], controller.signal).catch((error) => error);
        controller.abort();
        child.emit('close', 0, null);
        await expect(result).resolves.toMatchObject({ name: 'AbortError' });
    });

    test.each(['stdout', 'stderr'] as const)(
        'bounds %s and waits for process-tree cleanup on overflow',
        async (stream) => {
            const child = childFixture();
            const killer = childFixture(4102);
            spawnMock.mockReturnValueOnce(child).mockReturnValueOnce(killer);
            const result = runCopilotCli(runtime, [], signal()).catch((error) => error);
            let settled = false;
            void result.then(() => {
                settled = true;
            });
            child[stream]!.emit('data', Buffer.alloc(1024 * 1024 + 1));
            await flush();
            expect(settled).toBe(false);
            expect(spawnMock).toHaveBeenCalledTimes(2);
            child.emit('close', 1, null);
            killer.emit('close', 0, null);
            await expect(result).resolves.toMatchObject({ name: 'CopilotCliOutputLimitError' });
        }
    );

    test('applies one combined output limit to stdout and stderr', async () => {
        const child = childFixture();
        const killer = childFixture(4102);
        spawnMock.mockReturnValueOnce(child).mockReturnValueOnce(killer);
        const result = runCopilotCli(runtime, [], signal()).catch((error) => error);
        child.stdout!.emit('data', Buffer.alloc(600 * 1024));
        child.stderr!.emit('data', Buffer.alloc(600 * 1024));
        child.emit('close', 1, null);
        killer.emit('close', 0, null);
        await expect(result).resolves.toMatchObject({ name: 'CopilotCliOutputLimitError' });
    });

    test('surfaces Windows tree-kill failures and still waits for the child', async () => {
        const child = childFixture();
        const killer = childFixture(4102);
        spawnMock.mockReturnValueOnce(child).mockReturnValueOnce(killer);
        const controller = new AbortController();
        const result = runCopilotCli(runtime, [], controller.signal).catch((error) => error);
        let settled = false;
        void result.then(() => {
            settled = true;
        });
        controller.abort();
        killer.stderr!.emit('data', Buffer.from('access denied'));
        killer.emit('close', 1, null);
        await flush();
        expect(child.kill).toHaveBeenCalledWith('SIGKILL');
        expect(settled).toBe(false);
        child.emit('close', 1, null);
        await expect(result).resolves.toMatchObject({
            name: 'CopilotCliTerminationError',
            cause: expect.any(AggregateError),
        });
    });

    test('reports taskkill spawn failure without releasing the gate before child close', async () => {
        const child = childFixture();
        const killer = childFixture(4102);
        spawnMock.mockReturnValueOnce(child).mockReturnValueOnce(killer);
        const controller = new AbortController();
        const result = runCopilotCli(runtime, [], controller.signal).catch((error) => error);
        controller.abort();
        killer.emit('error', new Error('taskkill unavailable'));
        killer.emit('close', -2, null);
        await flush();
        expect(child.kill).toHaveBeenCalledWith('SIGKILL');
        child.emit('close', 1, null);
        await expect(result).resolves.toMatchObject({ name: 'CopilotCliTerminationError' });
    });

    test('removes the abort listener after completion, so later cancellation cannot kill a reused PID', async () => {
        const child = childFixture();
        spawnMock.mockReturnValue(child);
        const controller = new AbortController();
        const promise = runCopilotCli(runtime, [], controller.signal);
        child.emit('close', 0, null);
        await promise;
        controller.abort();
        expect(spawnMock).toHaveBeenCalledTimes(1);
        expect(process.kill).not.toHaveBeenCalled();
    });
});

describe('Copilot plain-text plugin inventory', () => {
    test('parses marketplace identities, disabled plugins, and built-in plugins', () => {
        expect(
            parsePluginList(
                'Installed plugins:\n  • dotnet-dnceng@dotnet-arcade-skills (v0.1.0)\n  • dotnet-test@dotnet-agent-skills (v0.1.0) [disabled]\n  • dotnet@dotnet-agent-skills (v0.1.0)\n\nBuilt-in Plugins (bundled with the CLI):\n  • computer-use\n'
            )
        ).toEqual([
            { name: 'dotnet-dnceng@dotnet-arcade-skills', enabled: true, kind: 'installed' },
            { name: 'dotnet-test@dotnet-agent-skills', enabled: false, kind: 'installed' },
            { name: 'dotnet@dotnet-agent-skills', enabled: true, kind: 'installed' },
            { name: 'computer-use', enabled: true, kind: 'builtin' },
        ]);
    });

    test('supports direct installs, ANSI colors, CRLF, and prerelease versions', () => {
        expect(
            parsePluginList(
                '\x1b[1mInstalled plugins:\x1b[0m\r\n  • dotnet (v0.2.4)\r\n  • other (v1.2.3-preview.1+build.2) [disabled]\r\n'
            )
        ).toEqual([
            { name: 'dotnet', enabled: true, kind: 'installed' },
            { name: 'other', enabled: false, kind: 'installed' },
        ]);
    });

    test.each([
        'No plugins installed.',
        "No plugins installed.\n\nUse 'copilot plugin install <source>' to install a plugin.\n",
    ])('accepts the explicit empty inventory format %j', (output) => {
        expect(parsePluginList(output)).toEqual([]);
    });

    test('keeps external plugins separate from installed plugins', () => {
        expect(
            parsePluginList('No plugins installed.\nExternal Plugins (via --plugin-dir):\n  • dotnet (v1.0.0)\n')
        ).toEqual([{ name: 'dotnet', enabled: true, kind: 'external' }]);
    });

    test('allows explicit empty installed inventory with bundled plugins', () => {
        expect(
            parsePluginList('No plugins installed.\nBuilt-in Plugins (bundled with the CLI):\n  • computer-use\n')
        ).toEqual([{ name: 'computer-use', enabled: true, kind: 'builtin' }]);
    });

    test.each([
        '',
        '   \n',
        '[]',
        '{"plugins":[]}',
        'Warning: could not read plugins',
        'Installed plugins:',
        'Installed plugins:\n  • dotnet (v0.',
        'Installed plugins:\n  • dotnet (v1.2.3',
        'Installed plugins:\n  • dotnet [dis',
        'Installed plugins:\n  • dotnet [unknown]',
        'Installed plugins:\n  • dotnet (v1.0.0)\n  • broken (',
        'Installed plugins:\n  • dotnet\nUnknown plugins:\n  • other',
        'Installed plugins:\n  • dotnet\nBuilt-in Plugins (bundled with the CLI):',
        'Installed plugins:\n  • dotnet\nInstalled plugins:\n  • other',
        'Installed plugins:\n  • dotnet\n  • dotnet',
        'No plugins installed.\nInstalled plugins:\n  • dotnet',
        'No plugins installed.\nNo plugins installed.',
        "Use 'copilot plugin install <source>' to install a plugin.",
        'No plugins installed.\nUnknown error',
        'Built-in Plugins (bundled with the CLI):\n  • computer-use',
        '  • dotnet (v1.0.0)',
        'Installed plugins:\n  • dotnet@@market',
        'Installed plugins:\n  • ../dotnet',
        'Installed plugins:\n  • dotnet\n    description: extra unknown output',
    ])('rejects malformed, truncated, or ambiguous inventory %j', (output) => {
        expect(() => parsePluginList(output)).toThrow(expect.objectContaining({ name: 'CopilotPluginInventoryError' }));
    });
});
