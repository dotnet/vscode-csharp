/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { ChildProcess, execFile, ExecFileException, ExecFileOptionsWithStringEncoding } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync, promises as fs, PathLike } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import type { CancellationToken } from 'vscode';
import { CopilotCli, findCopilotCli, parsePluginList, runCopilotCli } from '../../../src/shared/copilot/copilotCli';

jest.mock('fs', () => ({
    ...jest.requireActual<typeof import('fs')>('fs'),
    existsSync: jest.fn(),
    promises: { readFile: jest.fn() },
}));
jest.mock('os', () => ({
    ...jest.requireActual<typeof import('os')>('os'),
    platform: jest.fn(),
    homedir: jest.fn(),
}));
jest.mock('child_process', () => ({ execFile: jest.fn() }));

const files = new Map<string, string>();
const exists = jest.mocked(existsSync);
const readFile = jest.mocked<(file: PathLike, encoding: 'utf8') => Promise<string>>(fs.readFile);
type ExecFileCallback = (error: ExecFileException | null, stdout: string, stderr: string) => void;
const execFileMock =
    jest.mocked<
        (
            command: string,
            args: readonly string[],
            options: ExecFileOptionsWithStringEncoding,
            callback: ExecFileCallback
        ) => ChildProcess
    >(execFile);
const home = 'C:\\Users\\fixture';
const local = `${home}\\AppData\\Local`;
const roaming = `${home}\\AppData\\Roaming`;
const runtime: CopilotCli = { command: 'copilot', source: 'standalone' };
const appRuntime: CopilotCli = { command: 'C:\\Tools\\copilot.exe', source: 'app' };

class TestCancellationTokenSource {
    private cancelled = false;
    private readonly listeners = new Set<(event: unknown) => unknown>();
    readonly token: CancellationToken;

    constructor() {
        const isCancelled = () => this.cancelled;
        this.token = {
            get isCancellationRequested() {
                return isCancelled();
            },
            onCancellationRequested: (listener) => {
                this.listeners.add(listener);
                return { dispose: () => this.listeners.delete(listener) };
            },
        };
    }

    cancel(): void {
        this.cancelled = true;
        for (const listener of this.listeners) {
            listener(undefined);
        }
        this.listeners.clear();
    }
}

const token = () => new TestCancellationTokenSource().token;

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
    addFile(
        p.join(platform === 'darwin' ? p.join(root, 'Resources') : root, 'copilot-sdk', 'cliVersion.d.ts'),
        `export declare const COPILOT_CLI_VERSION = "${version}";`
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

function childFixture(): ChildProcess {
    return Object.assign(new EventEmitter(), {
        stdin: new PassThrough(),
    }) as unknown as ChildProcess;
}

function executionFixture(): { child: ChildProcess; callback: () => ExecFileCallback } {
    const child = childFixture();
    let callback: ExecFileCallback | undefined;
    execFileMock.mockImplementationOnce((_command, _args, _options, value) => {
        callback = value;
        return child;
    });
    return {
        child,
        callback: () => {
            if (!callback) {
                throw new Error('Copilot CLI was not executed');
            }
            return callback;
        },
    };
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
    setPlatform('win32');
    files.clear();
    exists.mockImplementation((file) => files.has(String(file)));
    readFile.mockImplementation(async (file) => {
        const name = String(file);
        const content = files.get(name);
        if (content === undefined) {
            throw missing(name);
        }
        return content;
    });
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('Copilot CLI filesystem discovery', () => {
    test('prefers the first CLI on PATH over an installed app', async () => {
        appFixture('win32');
        process.env.PATH = 'C:\\First;C:\\Second';
        addFile('C:\\First\\copilot.exe');
        addFile('C:\\Second\\copilot.exe');
        await expect(findCopilotCli()).resolves.toEqual({
            command: 'copilot',
            source: 'standalone',
        });
        expect(readFile).not.toHaveBeenCalled();
        expect(execFileMock).not.toHaveBeenCalled();
    });

    test('ignores empty, relative, drive-relative, and current-drive PATH entries', async () => {
        process.env.PATH = ';.;tools;C:tools;\\tools;;"C:\\Absolute Tools"';
        addFile('C:\\Absolute Tools\\copilot.exe');
        await expect(findCopilotCli()).resolves.toMatchObject({ command: 'copilot' });
        expect(exists.mock.calls.map((call) => String(call[0]))).toEqual(['C:\\Absolute Tools\\copilot.exe']);
    });

    test.each(['copilot.exe', 'copilot.cmd', 'copilot.bat'])('recognizes %s on PATH', async (name) => {
        process.env.PATH = 'C:\\Tools';
        addFile(`C:\\Tools\\${name}`);
        await expect(findCopilotCli()).resolves.toEqual({ command: 'copilot', source: 'standalone' });
        expect(readFile).not.toHaveBeenCalled();
    });

    test('supports a native or script CLI path on POSIX', async () => {
        setPlatform('linux');
        process.env.PATH = ':.:relative:/opt/copilot/bin';
        addFile('/opt/copilot/bin/copilot', '#!/usr/bin/env node');
        await expect(findCopilotCli()).resolves.toEqual({
            command: 'copilot',
            source: 'standalone',
        });
        expect(execFileMock).not.toHaveBeenCalled();
    });

    test('ignores standalone CLI installations outside PATH', async () => {
        process.env.PATH = 'C:\\Tools';
        const commands = [
            `${roaming}\\npm\\copilot.exe`,
            `${local}\\Microsoft\\WinGet\\Links\\copilot.exe`,
            `${local}\\Programs\\GitHub Copilot\\copilot.exe`,
        ];
        commands.forEach((command) => addFile(command));
        await expect(findCopilotCli()).resolves.toBeUndefined();
        for (const command of commands) {
            expect(exists).not.toHaveBeenCalledWith(command);
        }
    });

    test.each(['win32', 'darwin', 'linux'] as const)('uses the installed app runtime on %s', async (platform) => {
        const command = appFixture(platform);
        await expect(findCopilotCli()).resolves.toEqual({ command, source: 'app' });
    });

    test('requires installed app evidence instead of accepting a stale runtime cache', async () => {
        const command = appFixture('win32');
        files.delete(`${local}\\Programs\\GitHub Copilot\\github.exe`);
        await expect(findCopilotCli()).resolves.toBeUndefined();
        expect(exists).not.toHaveBeenCalledWith(command);
        expect(readFile).not.toHaveBeenCalled();
    });
});

describe('Copilot CLI process execution', () => {
    test('uses the shell for a standalone CLI with an argument array and closed stdin', async () => {
        const fixture = executionFixture();
        const args = ['plugin', 'install', 'dotnet@dotnet-agent-skills'];
        const promise = runCopilotCli(runtime, args, token());
        expect(execFileMock).toHaveBeenCalledWith(
            runtime.command,
            args,
            {
                cwd: home,
                env: process.env,
                windowsHide: true,
                shell: true,
                signal: expect.any(AbortSignal),
            },
            expect.any(Function)
        );
        expect(fixture.child.stdin?.writableEnded).toBe(true);
        fixture.callback()(null, 'installed\n', 'diagnostic');
        await expect(promise).resolves.toBe('installed\n');
        expect(process.env.COPILOT_HOME).toBe('C:\\Copilot Home');
    });

    test('executes an app runtime directly', async () => {
        const fixture = executionFixture();
        const promise = runCopilotCli(appRuntime, ['plugin', 'list'], token());
        expect(execFileMock).toHaveBeenCalledWith(
            appRuntime.command,
            ['plugin', 'list'],
            expect.objectContaining({ shell: false }),
            expect.any(Function)
        );
        fixture.callback()(null, '', '');
        await expect(promise).resolves.toBe('');
    });

    test('preserves UTF-8 output', async () => {
        const fixture = executionFixture();
        const promise = runCopilotCli(runtime, ['plugin', 'list'], token());
        fixture.callback()(null, '  • dotnet', '');
        await expect(promise).resolves.toBe('  • dotnet');
    });

    test('rejects a nonzero exit with useful stderr and exit details', async () => {
        const fixture = executionFixture();
        const promise = runCopilotCli(runtime, ['plugin', 'list'], token());
        fixture.callback()(Object.assign(new Error('failed'), { code: 7 }), '', 'permission denied');
        await expect(promise).rejects.toMatchObject({
            name: 'Error',
            message: expect.stringContaining('7, signal undefined: permission denied'),
        });
    });

    test('rejects termination by a signal instead of treating it as successful empty output', async () => {
        const fixture = executionFixture();
        const promise = runCopilotCli(runtime, ['plugin', 'list'], token());
        fixture.callback()(
            Object.assign(new Error('terminated'), { code: null, signal: 'SIGTERM' as NodeJS.Signals }),
            '',
            ''
        );
        await expect(promise).rejects.toMatchObject({
            name: 'Error',
            message: expect.stringContaining('SIGTERM'),
        });
    });

    test('preserves a generic execution error', async () => {
        const fixture = executionFixture();
        const error = Object.assign(new Error('execution failed'), { code: 'ENOENT' });
        const promise = runCopilotCli(runtime, [], token());
        fixture.callback()(error, '', '');
        await expect(promise).rejects.toBe(error);
    });

    test('cancels the process when requested', async () => {
        const fixture = executionFixture();
        const source = new TestCancellationTokenSource();
        const promise = runCopilotCli(runtime, [], source.token);
        const operation = execFileMock.mock.calls[0][2].signal;
        source.cancel();
        expect(operation?.aborted).toBe(true);
        fixture.callback()(Object.assign(new Error('aborted'), { code: 'ABORT_ERR' }), '', '');
        await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    });

    test('preserves a synchronous execFile error', async () => {
        const error = new Error('execution failed');
        execFileMock.mockImplementationOnce(() => {
            throw error;
        });
        await expect(runCopilotCli(runtime, [], token())).rejects.toBe(error);
    });

    test('does not spawn for a pre-cancelled operation', async () => {
        const source = new TestCancellationTokenSource();
        source.cancel();
        await expect(runCopilotCli(runtime, [], source.token)).rejects.toMatchObject({ name: 'AbortError' });
        expect(execFileMock).not.toHaveBeenCalled();
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

    test.each([
        ['Installed plugins:\n  • dotnet (v1.0.0)\n  • broken (', ['dotnet']],
        ['Installed plugins:\n  • dotnet@@market', []],
        ['Installed plugins:\n  • ../dotnet', []],
        ['Installed plugins:\n  • --help', []],
    ])('ignores entries it cannot safely interpret %j', (output, names) => {
        expect(parsePluginList(output as string).map((plugin) => plugin.name)).toEqual(names);
    });

    test('rejects output with no recognizable inventory', () => {
        expect(() => parsePluginList('Warning: could not read plugins')).toThrow(
            'Unrecognized Copilot plugin inventory'
        );
    });
});
