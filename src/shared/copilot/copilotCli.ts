/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { execFile } from 'child_process';
import { existsSync, promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { stripVTControlCharacters } from 'util';
import type { CancellationToken } from 'vscode';

export type CopilotCliSource = 'standalone' | 'app';

export interface CopilotCli {
    command: string;
    source: CopilotCliSource;
}

export interface CopilotPlugin {
    name: string;
    enabled: boolean;
    kind: 'installed' | 'builtin' | 'external';
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
    // process.env already resolves names case-insensitively on Windows.
    const value = process.env[name];
    return absolute(value) ? value : undefined;
}

function pathDirectories(): string[] {
    return (process.env.PATH ?? '')
        .split(platformPath().delimiter)
        .map((directory) => directory.trim().replace(/^"(.*)"$/, '$1'))
        .filter(absolute);
}

// The GitHub Copilot app does not expose the CLI directly; it downloads a pinned build into its cache.
async function appCli(directories: readonly string[]): Promise<CopilotCli | undefined> {
    const p = platformPath();
    const platform = os.platform();
    const home = os.homedir();
    const apps: { executable: string; resources: string }[] = [];
    let cache: string | undefined;
    if (platform === 'win32') {
        cache = environmentPath('LOCALAPPDATA');
        const roots = [
            ...(cache ? [p.join(cache, 'Programs', 'GitHub Copilot')] : []),
            ...['ProgramFiles', 'ProgramFiles(x86)']
                .map(environmentPath)
                .filter((root): root is string => root !== undefined)
                .map((root) => p.join(root, 'GitHub Copilot')),
            ...directories,
        ];
        for (const root of new Set(roots)) {
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
    if (!absolute(cache)) {
        return undefined;
    }
    for (const app of apps) {
        if (!existsSync(app.executable)) {
            continue;
        }
        const metadataPath = p.join(app.resources, 'copilot-sdk', 'cliVersion.d.ts');
        if (!existsSync(metadataPath)) {
            continue;
        }
        const metadata = await fs.readFile(metadataPath, 'utf8');
        // The version becomes a path segment, so only accept one that cannot escape the cache.
        const version = /const COPILOT_CLI_VERSION\s*=\s*"(\d+\.\d+\.\d+[\w.+-]*)";/.exec(metadata)?.[1];
        if (!version) {
            continue;
        }
        const command = p.join(
            cache,
            'github-copilot-sdk',
            'cli',
            version.replace(/[^a-zA-Z0-9._-]/g, '_'),
            platform === 'win32' ? 'copilot.exe' : 'copilot'
        );
        if (existsSync(command)) {
            return { command, source: 'app' };
        }
    }
    return undefined;
}

export async function findCopilotCli(): Promise<CopilotCli | undefined> {
    const p = platformPath();
    const platform = os.platform();
    const directories = pathDirectories();
    for (const directory of new Set(directories)) {
        const names = platform === 'win32' ? ['copilot.exe', 'copilot.cmd', 'copilot.bat'] : ['copilot'];
        if (names.some((name) => existsSync(p.join(directory, name)))) {
            return { command: 'copilot', source: 'standalone' };
        }
    }
    return await appCli(directories);
}

export async function runCopilotCli(
    cli: CopilotCli,
    args: readonly string[],
    token: CancellationToken
): Promise<string> {
    const controller = new AbortController();
    const cancellation = token.onCancellationRequested(() => controller.abort());
    try {
        if (token.isCancellationRequested) {
            controller.abort();
        }
        controller.signal.throwIfAborted();
        return await new Promise<string>((resolve, reject) => {
            const child = execFile(
                cli.command,
                [...args],
                {
                    windowsHide: true,
                    shell: cli.source === 'standalone',
                    cwd: os.homedir(),
                    env: process.env,
                    signal: controller.signal,
                },
                (error, stdout, stderr) => {
                    if (!error) {
                        resolve(stdout);
                    } else if (controller.signal.aborted) {
                        reject(controller.signal.reason);
                    } else if (typeof error.code === 'number' || error.signal) {
                        reject(
                            new Error(`Copilot CLI exited with code ${error.code}, signal ${error.signal}: ${stderr}`, {
                                cause: error,
                            })
                        );
                    } else {
                        reject(error);
                    }
                }
            );
            child.stdin?.end();
        });
    } finally {
        cancellation.dispose();
    }
}

const sections: [RegExp, CopilotPlugin['kind']][] = [
    [/^Installed plugins:$/i, 'installed'],
    [/^Built-in Plugins \(bundled with the CLI\):$/i, 'builtin'],
    [/^External Plugins \(via --plugin-dir\):$/i, 'external'],
];

export function parsePluginList(output: string): CopilotPlugin[] {
    const plugins: CopilotPlugin[] = [];
    let kind: CopilotPlugin['kind'] | undefined;
    let recognized = false;
    for (const line of stripVTControlCharacters(output).split(/\r?\n/)) {
        const text = line.trim();
        const heading = sections.find(([pattern]) => pattern.test(text))?.[1];
        if (heading || text === 'No plugins installed.') {
            kind = heading;
            recognized = true;
            continue;
        }
        // The name is passed back to the CLI as an argument, so it must not look like a flag.
        const entry = /^• ([a-zA-Z0-9][\w.-]*(?:@[a-zA-Z0-9][\w.-]*)?)(?: \(v[\w.+-]+\))?( \[disabled\])?$/.exec(text);
        if (kind && entry) {
            plugins.push({ name: entry[1], enabled: !entry[2], kind });
        }
    }
    if (!recognized) {
        // Report a CLI output format change instead of silently reinstalling or skipping removal.
        throw new Error('Unrecognized Copilot plugin inventory');
    }
    return plugins;
}
