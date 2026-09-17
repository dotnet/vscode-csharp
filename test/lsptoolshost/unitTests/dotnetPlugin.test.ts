/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import * as cli from '../../../src/shared/copilot/copilotCli';
import {
    DotnetPluginManager,
    dotnetPluginCacheKey,
    dotnetPluginOptOutKey,
    registerDotnetPlugin,
    uninstallDotnetPluginCommand,
} from '../../../src/shared/copilot/dotnetPlugin';
import { commonOptions } from '../../../src/shared/options';
import { TelemetryEventNames } from '../../../src/shared/telemetryEventNames';

jest.mock('vscode', () => ({
    workspace: {
        get isTrusted() {
            return true;
        },
    },
    window: { showInformationMessage: jest.fn(), showWarningMessage: jest.fn() },
    commands: { registerCommand: jest.fn() },
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
const showInformation = jest.mocked<(message: string, ...items: string[]) => Thenable<string | undefined>>(
    vscode.window.showInformationMessage
);
const runtime: cli.CopilotCli = { command: 'copilot', args: [], source: 'standalone' };
const plugin: cli.CopilotPlugin = { name: 'dotnet', enabled: true, kind: 'installed' };
const managers: DotnetPluginManager[] = [];

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
    const channel = { error: jest.fn(), info: jest.fn() };
    const manager = new DotnetPluginManager(context, reporter, channel);
    managers.push(manager);
    return { state, context, reporter, channel, manager };
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
    run.mockResolvedValue('inventory');
    parse.mockReturnValue([plugin]);
    jest.mocked(vscode.env.openExternal).mockResolvedValue(true);
    jest.mocked(vscode.commands.registerCommand).mockReturnValue({ dispose: jest.fn() });
});

afterEach(() => {
    managers.splice(0).forEach((manager) => manager.dispose());
    jest.restoreAllMocks();
    jest.useRealTimers();
});

describe('Copilot .NET plugin lifecycle', () => {
    test('installs and confirms before caching and notifying', async () => {
        const { manager, state, reporter } = fixture();
        parse.mockReturnValueOnce([]).mockReturnValueOnce([plugin]);
        await manager.install();
        expect(run.mock.calls.map((call) => call[1])).toEqual([
            ['plugin', 'list'],
            ['plugin', 'install', 'dotnet/skills:plugins/dotnet'],
            ['plugin', 'list'],
        ]);
        expect(state.get(dotnetPluginCacheKey)).toEqual({
            extensionVersion: '1.2.3',
            outcome: 'alreadyInstalled',
            source: 'standalone',
        });
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Installed the C# LSP .NET plugin for GitHub Copilot',
            'Learn More'
        );
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledTimes(1);
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.CopilotDotnetPlugin, {
            outcome: 'installed',
            source: 'standalone',
            cached: 'false',
        });
        expect(jest.getTimerCount()).toBe(0);
    });

    test.each(['alreadyInstalled', 'alreadyInstalledDisabled', 'conflictingPlugin'])(
        'cached %s skips discovery and all CLI calls',
        async (outcome) => {
            const { manager, state, reporter } = fixture();
            state.values.set(dotnetPluginCacheKey, { extensionVersion: '1.2.3', outcome, source: 'app' });
            await manager.install();
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

    test.each([
        ['0.1.0', 'alreadyInstalled'],
        ['9.0.0', 'alreadyInstalled'],
        ['1.2.3', 'invalid'],
    ])('invalidates old or malformed cache (%s, %s)', async (extensionVersion, outcome) => {
        const { manager, state } = fixture();
        state.values.set(dotnetPluginCacheKey, { extensionVersion, outcome, source: 'app' });
        await manager.install();
        expect(state.update).toHaveBeenNthCalledWith(1, dotnetPluginCacheKey, undefined);
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
        const { manager, state } = fixture();
        parse.mockReturnValue([existing]);
        await manager.install();
        expect(run).toHaveBeenCalledTimes(1);
        expect(state.get(dotnetPluginCacheKey)).toMatchObject({ outcome });
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    test('unavailable Copilot stays uncached and is discovered on the next activation', async () => {
        const { manager, state, context, reporter, channel } = fixture();
        find.mockResolvedValueOnce(undefined);
        await manager.install();
        expect(run).not.toHaveBeenCalled();
        expect(state.update).not.toHaveBeenCalled();
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.CopilotDotnetPlugin, {
            outcome: 'copilotNotAvailable',
            source: 'none',
            cached: 'false',
        });
        const next = new DotnetPluginManager(context, reporter, channel);
        managers.push(next);
        await next.install();
        expect(find).toHaveBeenCalledTimes(2);
        expect(run).toHaveBeenCalledTimes(1);
    });

    test.each(['optedOut', 'aiDisabled', 'untrustedWorkspace'])('cheap gate %s precedes cache', async (outcome) => {
        const { manager, state, context, reporter } = fixture();
        state.values.set(dotnetPluginCacheKey, {
            extensionVersion: '1.2.3',
            outcome: 'alreadyInstalled',
            source: 'app',
        });
        if (outcome === 'optedOut') {
            state.values.set(dotnetPluginOptOutKey, true);
            context.extension.packageJSON.version = '2.0.0';
        } else if (outcome === 'aiDisabled') {
            jest.spyOn(commonOptions, 'disableAIFeatures', 'get').mockReturnValue(true);
        } else {
            jest.spyOn(vscode.workspace, 'isTrusted', 'get').mockReturnValue(false);
        }
        await manager.install();
        expect(find).not.toHaveBeenCalled();
        expect(state.update).not.toHaveBeenCalled();
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.CopilotDotnetPlugin, {
            outcome,
            source: 'none',
            cached: 'false',
        });
    });

    test.each(['discovery', 'inventory', 'install', 'confirmation'])(
        'failure during %s is not cached',
        async (stage) => {
            const { manager, state, reporter, channel } = fixture();
            const error = new Error('private path or output');
            if (stage === 'discovery') {
                find.mockRejectedValue(error);
            } else if (stage === 'inventory') {
                parse.mockImplementation(() => {
                    throw error;
                });
            } else if (stage === 'install') {
                parse.mockReturnValue([]);
                run.mockResolvedValueOnce('empty').mockRejectedValueOnce(error);
            } else {
                parse.mockReturnValue([]);
            }
            await manager.install();
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

    test('cache write failure does not turn successful installation into failure', async () => {
        const { manager, state, reporter } = fixture();
        parse.mockReturnValueOnce([]).mockReturnValueOnce([plugin]);
        state.update.mockRejectedValueOnce(new Error('storage unavailable'));
        await manager.install();
        expect(reporter.sendTelemetryEvent.mock.calls[0][1]).toMatchObject({ outcome: 'installed' });
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledTimes(1);
        expect(reporter.sendTelemetryErrorEvent.mock.calls[0][1]).toMatchObject({
            stage: 'cache',
            outcome: 'installed',
        });
        expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    test('uses one overall timeout and cancels a running command', async () => {
        const { manager, state, reporter } = fixture();
        const started = deferred<AbortSignal>();
        run.mockImplementation(async (_cli, _args, signal) => {
            started.resolve(signal);
            return await new Promise<string>((_resolve, reject) => {
                signal.addEventListener('abort', () => reject(signal.reason), { once: true });
            });
        });
        const pending = manager.install();
        const signal = await started.promise;
        await jest.advanceTimersByTimeAsync(120_000);
        await pending;
        expect(signal.aborted).toBe(true);
        expect(state.update).not.toHaveBeenCalled();
        expect(reporter.sendTelemetryErrorEvent.mock.calls[0][1]).toMatchObject({ 'error.name': 'TimeoutError' });
        expect(jest.getTimerCount()).toBe(0);
    });

    test('discovery timeout prevents a late result from starting CLI work', async () => {
        const { manager, reporter } = fixture();
        const found = deferred<cli.CopilotCli>();
        const started = deferred<void>();
        find.mockImplementation(async () => {
            started.resolve();
            return await found.promise;
        });
        const pending = manager.install();
        await started.promise;
        await jest.advanceTimersByTimeAsync(120_000);
        await pending;
        found.resolve(runtime);
        await Promise.resolve();
        expect(run).not.toHaveBeenCalled();
        expect(reporter.sendTelemetryEvent.mock.calls[0][1]).toMatchObject({ outcome: 'installFailed' });
    });

    test('uninstall bypasses cached results and persists opt-out across versions', async () => {
        const { manager, state, context, reporter, channel } = fixture();
        state.values.set(dotnetPluginCacheKey, {
            extensionVersion: '1.2.3',
            outcome: 'conflictingPlugin',
            source: 'app',
        });
        parse.mockReturnValueOnce([{ ...plugin, name: 'dotnet@dotnet-agent-skills' }]).mockReturnValueOnce([]);
        await manager.uninstall();
        expect(state.update).toHaveBeenNthCalledWith(1, dotnetPluginOptOutKey, true);
        expect(state.get(dotnetPluginCacheKey)).toBeUndefined();
        expect(run.mock.calls.map((call) => call[1])).toEqual([
            ['plugin', 'list'],
            ['plugin', 'uninstall', 'dotnet@dotnet-agent-skills'],
            ['plugin', 'list'],
        ]);
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.CopilotDotnetPluginUninstall, {
            outcome: 'uninstalled',
            source: 'standalone',
        });
        context.extension.packageJSON.version = '2.0.0';
        const next = new DotnetPluginManager(context, reporter, channel);
        managers.push(next);
        find.mockClear();
        await next.install();
        expect(find).not.toHaveBeenCalled();
        expect(reporter.sendTelemetryEvent).toHaveBeenLastCalledWith(TelemetryEventNames.CopilotDotnetPlugin, {
            outcome: 'optedOut',
            source: 'none',
            cached: 'false',
        });
    });

    test.each(['alreadyAbsent', 'copilotNotAvailable', 'uninstallFailed'])(
        'uninstall %s leaves the durable opt-out set',
        async (outcome) => {
            const { manager, state, reporter } = fixture();
            if (outcome === 'alreadyAbsent') {
                parse.mockReturnValue([]);
            }
            if (outcome === 'copilotNotAvailable') {
                find.mockResolvedValue(undefined);
            }
            if (outcome === 'uninstallFailed') {
                run.mockRejectedValue(new Error('failed'));
            }
            await manager.uninstall();
            expect(state.get(dotnetPluginOptOutKey)).toBe(true);
            expect(reporter.sendTelemetryEvent.mock.calls[0][0]).toBe(TelemetryEventNames.CopilotDotnetPluginUninstall);
            expect(reporter.sendTelemetryEvent.mock.calls[0][1]).toMatchObject({ outcome });
        }
    );

    test('failed opt-out persistence aborts removal', async () => {
        const { manager, state, reporter } = fixture();
        state.update.mockRejectedValueOnce(new Error('storage failed'));
        await manager.uninstall();
        expect(find).not.toHaveBeenCalled();
        expect(run).not.toHaveBeenCalled();
        expect(reporter.sendTelemetryErrorEvent.mock.calls[0][1]).toMatchObject({ stage: 'optOut' });
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'Could not disable automatic installation. See the C# output for details.'
        );
    });

    test('uninstall waits for active installation and suppresses its toast/cache', async () => {
        const { manager, state, reporter } = fixture();
        const started = deferred<void>();
        const installed = deferred<string>();
        run.mockImplementation(async (_cli, args) => {
            if (args[1] === 'install') {
                started.resolve();
                return await installed.promise;
            }
            return 'inventory';
        });
        parse
            .mockReturnValueOnce([])
            .mockReturnValueOnce([plugin])
            .mockReturnValueOnce([plugin])
            .mockReturnValueOnce([]);
        const installing = manager.install();
        await started.promise;
        const uninstalling = manager.uninstall();
        expect(run.mock.calls.some((call) => call[1][1] === 'uninstall')).toBe(false);
        installed.resolve('installed');
        await Promise.all([installing, uninstalling]);
        expect(run.mock.calls.map((call) => call[1][1])).toEqual([
            'list',
            'install',
            'list',
            'list',
            'uninstall',
            'list',
        ]);
        expect(state.get(dotnetPluginCacheKey)).toBeUndefined();
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalledWith(
            'Installed the C# LSP .NET plugin for GitHub Copilot',
            'Learn More'
        );
        expect(reporter.sendTelemetryEvent.mock.calls.map((call) => call[0])).toEqual([
            TelemetryEventNames.CopilotDotnetPlugin,
            TelemetryEventNames.CopilotDotnetPluginUninstall,
        ]);
    });

    test('pending uninstall prevents queued automatic installation', async () => {
        const { manager } = fixture();
        parse.mockReturnValue([]);
        await Promise.all([manager.install(), manager.uninstall()]);
        expect(run.mock.calls.map((call) => call[1])).toEqual([['plugin', 'list']]);
    });

    test('disposal cancels background work and suppresses notifications', async () => {
        const { manager, state } = fixture();
        const started = deferred<AbortSignal>();
        find.mockImplementation(async (signal) => {
            started.resolve(signal);
            return await new Promise<undefined>((_resolve, reject) => {
                signal.addEventListener('abort', () => reject(signal.reason), { once: true });
            });
        });
        const pending = manager.install();
        const signal = await started.promise;
        manager.dispose();
        await pending;
        expect(signal.aborted).toBe(true);
        expect(run).not.toHaveBeenCalled();
        expect(state.update).not.toHaveBeenCalled();
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    test.each(['dismissed', 'opened', 'refused', 'throws'])(
        'documentation action %s cannot change install outcome',
        async (action) => {
            const { manager, reporter, channel } = fixture();
            parse.mockReturnValueOnce([]).mockReturnValueOnce([plugin]);
            showInformation.mockResolvedValue(action === 'dismissed' ? undefined : 'Learn More');
            if (action === 'refused') {
                jest.mocked(vscode.env.openExternal).mockResolvedValue(false);
            }
            if (action === 'throws') {
                jest.mocked(vscode.env.openExternal).mockRejectedValue(new Error('browser failed'));
            }
            await manager.install();
            await Promise.resolve();
            expect(reporter.sendTelemetryEvent).toHaveBeenCalledTimes(1);
            expect(reporter.sendTelemetryEvent.mock.calls[0][1]).toMatchObject({ outcome: 'installed' });
            if (action === 'dismissed') {
                expect(vscode.env.openExternal).not.toHaveBeenCalled();
            } else {
                expect(vscode.env.openExternal).toHaveBeenCalledWith(
                    'https://github.com/dotnet/vscode-csharp/blob/main/docs/Copilot-Dotnet-Plugin.md'
                );
            }
            if (action === 'refused' || action === 'throws') {
                expect(channel.error).toHaveBeenCalled();
            }
        }
    );

    test('telemetry failures are logged without recursion or escaping', async () => {
        const { manager, reporter, channel } = fixture();
        reporter.sendTelemetryEvent.mockImplementation(() => {
            throw new Error('telemetry failed');
        });
        reporter.sendTelemetryErrorEvent.mockImplementation(() => {
            throw new Error('telemetry failed');
        });
        find.mockRejectedValue(new Error('discovery failed'));
        await expect(manager.install()).resolves.toBeUndefined();
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledTimes(1);
        expect(reporter.sendTelemetryErrorEvent).toHaveBeenCalledTimes(1);
        expect(channel.error).toHaveBeenCalled();
    });

    test('registration returns before deferred work and owns its disposables', async () => {
        const { context, reporter, channel } = fixture();
        const install = jest.spyOn(DotnetPluginManager.prototype, 'install').mockResolvedValue();
        const uninstall = jest.spyOn(DotnetPluginManager.prototype, 'uninstall').mockResolvedValue();
        expect(registerDotnetPlugin(context, reporter, channel)).toBeUndefined();
        expect(install).not.toHaveBeenCalled();
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            uninstallDotnetPluginCommand,
            expect.any(Function)
        );
        await jest.advanceTimersByTimeAsync(0);
        expect(install).toHaveBeenCalledTimes(1);
        const handler = jest.mocked(vscode.commands.registerCommand).mock.calls[0][1];
        await handler();
        expect(uninstall).toHaveBeenCalledTimes(1);
        context.subscriptions.forEach((subscription) => subscription.dispose());
    });

    test('test extension hosts never start automatic plugin operations', async () => {
        const { context, reporter, channel } = fixture();
        context.extensionMode = vscode.ExtensionMode.Test;
        const install = jest.spyOn(DotnetPluginManager.prototype, 'install');
        registerDotnetPlugin(context, reporter, channel);
        await jest.advanceTimersByTimeAsync(0);
        expect(install).not.toHaveBeenCalled();
        expect(find).not.toHaveBeenCalled();
        context.subscriptions.forEach((subscription) => subscription.dispose());
    });
});
