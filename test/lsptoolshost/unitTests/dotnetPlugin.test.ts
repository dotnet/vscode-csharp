/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import * as cli from '../../../src/shared/copilot/copilotCli';
import {
    DotnetPluginHost,
    dotnetPluginAutoInstallKey,
    dotnetPluginCacheKey,
    installDotnetPlugin,
    registerDotnetPlugin,
} from '../../../src/shared/copilot/dotnetPlugin';
import { commonOptions } from '../../../src/shared/options';
import { TelemetryEventNames } from '../../../src/shared/telemetryEventNames';

jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: jest.fn(),
        get isTrusted() {
            return true;
        },
    },
    window: { showInformationMessage: jest.fn() },
    env: { openExternal: jest.fn() },
    Uri: { parse: (value: string) => value },
    l10n: { t: (value: string) => value },
    ExtensionMode: { Production: 1, Development: 2, Test: 3 },
}));
jest.mock('../../../src/shared/options', () => ({
    commonOptions: {
        get disableAIFeatures() {
            return false;
        },
    },
}));
jest.mock('../../../src/shared/copilot/copilotCli', () => ({
    findCopilotCli: jest.fn(),
    runCopilotCli: jest.fn(),
    parsePluginList: jest.fn(),
}));

const find = jest.mocked(cli.findCopilotCli);
const run = jest.mocked(cli.runCopilotCli);
const parse = jest.mocked(cli.parsePluginList);
const runtime: cli.CopilotCli = { command: 'copilot', source: 'standalone' };
const plugin: cli.CopilotPlugin = { name: 'dotnet', enabled: true, kind: 'installed' };
const signal = () => new AbortController().signal;

class MemoryState implements vscode.Memento {
    readonly values = new Map<string, unknown>();
    readonly update = jest.fn(async (key: string, value: unknown) => {
        if (value === undefined) {
            this.values.delete(key);
        } else {
            this.values.set(key, value);
        }
    });
    keys(): readonly string[] {
        return [...this.values.keys()];
    }
    get<T>(key: string): T | undefined;
    get<T>(key: string, fallback: T): T;
    get<T>(key: string, fallback?: T): T | undefined {
        return this.values.has(key) ? (this.values.get(key) as T) : fallback;
    }
}

function fixture() {
    const state = new MemoryState();
    const context = {
        globalState: state,
        extension: { packageJSON: { version: '1.2.3' } },
        subscriptions: new Array<vscode.Disposable>(),
        extensionMode: vscode.ExtensionMode.Production,
    };
    const reporter = { sendTelemetryEvent: jest.fn(), sendTelemetryErrorEvent: jest.fn() };
    const channel = { error: jest.fn(), info: jest.fn(), trace: jest.fn() };
    const host: DotnetPluginHost = { context, reporter, channel };
    return { state, context, reporter, channel, host };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    find.mockResolvedValue(runtime);
    run.mockImplementation(async (_runtime, args) =>
        args[1] === 'marketplace' && args[2] === 'list' ? '[]' : 'inventory'
    );
    parse.mockReturnValue([plugin]);
    jest.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: <T>(_section: string, defaultValue?: T) => defaultValue,
    } as vscode.WorkspaceConfiguration);
});

afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
});

describe('Copilot .NET plugin installation', () => {
    test('installs before caching and notifying', async () => {
        const { host, state, reporter } = fixture();
        parse.mockReturnValueOnce([]);
        await installDotnetPlugin(host, signal());
        expect(run.mock.calls.map((call) => call[1])).toEqual([
            ['plugin', 'list'],
            ['plugin', 'marketplace', 'list', '--json'],
            ['plugin', 'marketplace', 'add', 'dotnet/skills'],
            ['plugin', 'install', 'dotnet@dotnet-agent-skills'],
        ]);
        expect(state.get(dotnetPluginCacheKey)).toEqual({
            extensionVersion: '1.2.3',
            outcome: 'alreadyInstalled',
            source: 'standalone',
        });
        expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(1);
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledTimes(1);
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.CopilotDotnetPlugin, {
            outcome: 'installed',
            source: 'standalone',
            cached: 'false',
        });
        expect(jest.getTimerCount()).toBe(0);
    });

    test('uses an already-registered marketplace without adding it again', async () => {
        const { host } = fixture();
        parse.mockReturnValueOnce([]);
        run.mockImplementation(async (_runtime, args) =>
            args[1] === 'marketplace' && args[2] === 'list'
                ? '[{"name":"dotnet-agent-skills","source":"GitHub: dotnet/skills","isDefault":false}]'
                : 'inventory'
        );
        await installDotnetPlugin(host, signal());
        expect(run.mock.calls.map((call) => call[1])).toEqual([
            ['plugin', 'list'],
            ['plugin', 'marketplace', 'list', '--json'],
            ['plugin', 'install', 'dotnet@dotnet-agent-skills'],
        ]);
    });

    test.each(['alreadyInstalled', 'alreadyInstalledDisabled', 'conflictingPlugin'])(
        'cached %s skips discovery and all CLI calls',
        async (outcome) => {
            const { host, state, reporter } = fixture();
            state.values.set(dotnetPluginCacheKey, { extensionVersion: '1.2.3', outcome, source: 'app' });
            await installDotnetPlugin(host, signal());
            expect(find).not.toHaveBeenCalled();
            expect(run).not.toHaveBeenCalled();
            expect(state.update).not.toHaveBeenCalled();
            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
            expect(reporter.sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.CopilotDotnetPlugin, {
                outcome,
                source: 'app',
                cached: 'true',
            });
        }
    );

    test('ignores a cache from another extension version', async () => {
        const { host, state } = fixture();
        state.values.set(dotnetPluginCacheKey, {
            extensionVersion: '0.1.0',
            outcome: 'alreadyInstalled',
            source: 'app',
        });
        await installDotnetPlugin(host, signal());
        expect(find).toHaveBeenCalledTimes(1);
        expect(state.get(dotnetPluginCacheKey)).toEqual({
            extensionVersion: '1.2.3',
            outcome: 'alreadyInstalled',
            source: 'standalone',
        });
    });

    test.each<[cli.CopilotPlugin, string]>([
        [plugin, 'alreadyInstalled'],
        [{ ...plugin, name: 'dotnet@dotnet-agent-skills', enabled: false }, 'alreadyInstalledDisabled'],
        [{ ...plugin, name: 'dotnet@different-marketplace' }, 'conflictingPlugin'],
        [{ ...plugin, kind: 'builtin' }, 'conflictingPlugin'],
    ])('preserves and caches existing plugin %j', async (existing, outcome) => {
        const { host, state } = fixture();
        parse.mockReturnValue([existing]);
        await installDotnetPlugin(host, signal());
        expect(run).toHaveBeenCalledTimes(1);
        expect(state.get(dotnetPluginCacheKey)).toMatchObject({ outcome });
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    test('unavailable Copilot stays uncached and is rediscovered on the next activation', async () => {
        const { host, state, reporter } = fixture();
        find.mockResolvedValueOnce(undefined);
        await installDotnetPlugin(host, signal());
        expect(run).not.toHaveBeenCalled();
        expect(state.update).not.toHaveBeenCalled();
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.CopilotDotnetPlugin, {
            outcome: 'copilotNotAvailable',
            source: 'none',
            cached: 'false',
        });
        await installDotnetPlugin(host, signal());
        expect(find).toHaveBeenCalledTimes(2);
        expect(run).toHaveBeenCalledTimes(1);
    });

    test.each(['autoInstallDisabled', 'aiDisabled', 'untrustedWorkspace'])(
        'cheap gate %s precedes the cache',
        async (outcome) => {
            const { host, state, reporter } = fixture();
            state.values.set(dotnetPluginCacheKey, {
                extensionVersion: '1.2.3',
                outcome: 'alreadyInstalled',
                source: 'app',
            });
            if (outcome === 'autoInstallDisabled') {
                jest.mocked(vscode.workspace.getConfiguration).mockReturnValue({
                    get: (section: string, defaultValue?: unknown) =>
                        section === dotnetPluginAutoInstallKey ? false : defaultValue,
                } as vscode.WorkspaceConfiguration);
            } else if (outcome === 'aiDisabled') {
                jest.spyOn(commonOptions, 'disableAIFeatures', 'get').mockReturnValue(true);
            } else {
                jest.spyOn(vscode.workspace, 'isTrusted', 'get').mockReturnValue(false);
            }
            await installDotnetPlugin(host, signal());
            expect(find).not.toHaveBeenCalled();
            expect(state.update).not.toHaveBeenCalled();
            expect(reporter.sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.CopilotDotnetPlugin, {
                outcome,
                source: 'none',
                cached: 'false',
            });
        }
    );

    test.each(['discovery', 'inventory', 'marketplace', 'install'])(
        'failure during %s is not cached',
        async (stage) => {
            const { host, state, reporter, channel } = fixture();
            const error = new Error('private path or output');
            if (stage === 'discovery') {
                find.mockRejectedValue(error);
            } else if (stage === 'inventory') {
                parse.mockImplementation(() => {
                    throw error;
                });
            } else {
                parse.mockReturnValue([]);
                run.mockImplementation(async (_runtime, args) => {
                    if (stage === 'marketplace' && args[1] === 'marketplace') {
                        throw error;
                    }
                    if (args[1] === 'marketplace' && args[2] === 'list') {
                        return '[{"name":"dotnet-agent-skills"}]';
                    }
                    if (stage === 'install' && args[1] === 'install') {
                        throw error;
                    }
                    return 'inventory';
                });
            }
            await installDotnetPlugin(host, signal());
            expect(state.update).not.toHaveBeenCalled();
            expect(channel.error).toHaveBeenCalled();
            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
            expect(reporter.sendTelemetryEvent).toHaveBeenCalledTimes(1);
            expect(reporter.sendTelemetryEvent.mock.calls[0][1]).toMatchObject({ outcome: 'installFailed' });
            expect(reporter.sendTelemetryErrorEvent.mock.calls[0][1]).toMatchObject({
                stage,
                outcome: 'installFailed',
            });
            expect(JSON.stringify(reporter.sendTelemetryErrorEvent.mock.calls)).not.toContain('private path');
        }
    );

    test('cache write failure is reported like other installation failures', async () => {
        const { host, state, reporter } = fixture();
        parse.mockReturnValueOnce([]);
        state.update.mockRejectedValueOnce(new Error('storage unavailable'));
        await installDotnetPlugin(host, signal());
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledTimes(1);
        expect(reporter.sendTelemetryEvent.mock.calls[0][1]).toMatchObject({ outcome: 'installFailed' });
        expect(reporter.sendTelemetryErrorEvent.mock.calls[0][1]).toMatchObject({
            stage: 'cache',
            outcome: 'installFailed',
        });
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    test('uses one overall timeout and cancels a running command', async () => {
        const { host, state, reporter } = fixture();
        const started = deferred<AbortSignal>();
        run.mockImplementation(async (_cli, _args, commandSignal) => {
            started.resolve(commandSignal);
            return await new Promise<string>((_resolve, reject) => {
                commandSignal.addEventListener('abort', () => reject(commandSignal.reason), { once: true });
            });
        });
        const pending = installDotnetPlugin(host, signal());
        const commandSignal = await started.promise;
        await jest.advanceTimersByTimeAsync(120_000);
        await pending;
        expect(commandSignal.aborted).toBe(true);
        expect(state.update).not.toHaveBeenCalled();
        expect(reporter.sendTelemetryErrorEvent.mock.calls[0][1]).toMatchObject({ 'error.name': 'TimeoutError' });
        expect(jest.getTimerCount()).toBe(0);
    });

    test('deactivation cancels background work without reporting a failure', async () => {
        const { host, state } = fixture();
        const controller = new AbortController();
        const started = deferred<AbortSignal>();
        parse.mockReturnValue([]);
        run.mockImplementation(async (_cli, args, commandSignal) => {
            if (args[1] === 'marketplace' && args[2] === 'list') {
                return '[]';
            }
            if (args[1] !== 'install') {
                return 'inventory';
            }
            started.resolve(commandSignal);
            return await new Promise<string>((_resolve, reject) => {
                commandSignal.addEventListener('abort', () => reject(commandSignal.reason), { once: true });
            });
        });
        const pending = installDotnetPlugin(host, controller.signal);
        const commandSignal = await started.promise;
        controller.abort(new Error('deactivated'));
        await pending;
        expect(commandSignal.aborted).toBe(true);
        expect(state.update).not.toHaveBeenCalled();
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
    });
});

describe('Copilot .NET plugin registration', () => {
    test('starts automatic installation and owns its disposables', async () => {
        const { context, reporter, channel } = fixture();
        expect(registerDotnetPlugin(context, reporter, channel)).toBeUndefined();
        expect(find).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(0);
        context.subscriptions.forEach((subscription) => subscription.dispose());
    });

    test('test extension hosts never start automatic plugin operations', async () => {
        const { context, reporter, channel } = fixture();
        context.extensionMode = vscode.ExtensionMode.Test;
        registerDotnetPlugin(context, reporter, channel);
        await jest.advanceTimersByTimeAsync(0);
        expect(find).not.toHaveBeenCalled();
        context.subscriptions.forEach((subscription) => subscription.dispose());
    });
});
