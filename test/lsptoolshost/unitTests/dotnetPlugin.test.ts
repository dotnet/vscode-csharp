/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import * as cli from '../../../src/shared/copilot/copilotCli';
import {
    dotnetPluginAutoInstallKey,
    dotnetPluginCacheKey,
    registerDotnetPlugin,
} from '../../../src/shared/copilot/dotnetPlugin';
import { commonOptions } from '../../../src/shared/options';
import { TelemetryEventNames } from '../../../src/shared/telemetryEventNames';

jest.mock('vscode', () => {
    class CancellationError extends Error {}
    class CancellationTokenSource {
        private cancelled = false;
        private readonly listeners = new Set<(event: unknown) => unknown>();
        readonly token: {
            readonly isCancellationRequested: boolean;
            onCancellationRequested(listener: (event: unknown) => unknown): { dispose(): void };
        };

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

        dispose(): void {
            this.listeners.clear();
        }
    }

    return {
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
        CancellationError,
        CancellationTokenSource,
    };
});
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
    return { state, context, reporter, channel };
}

type Fixture = ReturnType<typeof fixture>;

async function install(fixture: Fixture) {
    return registerDotnetPlugin(fixture.context, fixture.reporter, fixture.channel);
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

function cliOutput(args: readonly string[]): string {
    if (args[0] === '--version') {
        return "GitHub Copilot CLI 1.0.85.\nRun 'copilot update' to check for updates.\n";
    }
    return args[1] === 'marketplace' && args[2] === 'list' ? '[]' : 'inventory';
}

beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    find.mockResolvedValue(runtime);
    run.mockImplementation(async (_runtime, args) => cliOutput(args));
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
        const testFixture = fixture();
        const { state, reporter } = testFixture;
        parse.mockReturnValueOnce([]);
        await expect(install(testFixture)).resolves.toBe('installed');
        expect(run.mock.calls.map((call) => call[1])).toEqual([
            ['plugin', 'list'],
            ['--version'],
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
        const testFixture = fixture();
        parse.mockReturnValueOnce([]);
        run.mockImplementation(async (_runtime, args) =>
            args[1] === 'marketplace' && args[2] === 'list'
                ? '[{"name":"dotnet-agent-skills","source":"GitHub: dotnet/skills","isDefault":false}]'
                : cliOutput(args)
        );
        await install(testFixture);
        expect(run.mock.calls.map((call) => call[1])).toEqual([
            ['plugin', 'list'],
            ['--version'],
            ['plugin', 'marketplace', 'list', '--json'],
            ['plugin', 'install', 'dotnet@dotnet-agent-skills'],
        ]);
    });

    test('caches an unexpected marketplace source as a conflict', async () => {
        const testFixture = fixture();
        const { state, reporter, channel } = testFixture;
        parse.mockReturnValueOnce([]);
        run.mockImplementation(async (_runtime, args) =>
            args[1] === 'marketplace' && args[2] === 'list'
                ? '[{"name":"dotnet-agent-skills","source":"GitHub: example/skills","isDefault":false}]'
                : cliOutput(args)
        );

        await expect(install(testFixture)).resolves.toBe('conflictingMarketplace');
        expect(run.mock.calls.map((call) => call[1])).toEqual([
            ['plugin', 'list'],
            ['--version'],
            ['plugin', 'marketplace', 'list', '--json'],
        ]);
        expect(state.get(dotnetPluginCacheKey)).toEqual({
            extensionVersion: '1.2.3',
            outcome: 'conflictingMarketplace',
            source: 'standalone',
        });
        expect(channel.info).toHaveBeenCalledWith(expect.stringContaining('unexpected source'));
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.CopilotDotnetPlugin, {
            outcome: 'conflictingMarketplace',
            source: 'standalone',
            cached: 'false',
        });
    });

    test.each([
        'GitHub Copilot CLI 1.0.84-4.\r\n',
        'GitHub Copilot CLI 1.0.85+build.10.\n',
        'GitHub Copilot CLI 1.0.85\n',
    ])('allows installation with compatible CLI output %j', async (output) => {
        const testFixture = fixture();
        parse.mockReturnValue([]);
        run.mockResolvedValueOnce('inventory').mockResolvedValueOnce(output);

        await expect(install(testFixture)).resolves.toBe('installed');
    });

    test.each<[string, cli.CopilotCliSource]>([
        ['1.0.81-6', 'standalone'],
        ['1.0.84-3', 'app'],
    ])('skips incompatible CLI %s from %s without caching or error telemetry', async (version, source) => {
        const testFixture = fixture();
        const { state, reporter, channel } = testFixture;
        find.mockResolvedValue({ ...runtime, source });
        parse.mockReturnValue([]);
        run.mockResolvedValueOnce('inventory').mockResolvedValueOnce(`GitHub Copilot CLI ${version}.\n`);

        await expect(install(testFixture)).resolves.toBe('incompatibleCli');
        expect(run.mock.calls.map((call) => call[1])).toEqual([['plugin', 'list'], ['--version']]);
        expect(state.update).not.toHaveBeenCalled();
        expect(channel.info).toHaveBeenCalled();
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledTimes(1);
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.CopilotDotnetPlugin, {
            outcome: 'incompatibleCli',
            source,
            cached: 'false',
        });
        expect(reporter.sendTelemetryErrorEvent).not.toHaveBeenCalled();
    });

    test('rechecks an incompatible CLI after an upgrade without changing the extension version', async () => {
        const testFixture = fixture();
        parse.mockReturnValue([]);
        run.mockResolvedValueOnce('inventory').mockResolvedValueOnce('GitHub Copilot CLI 1.0.83.\n');

        await expect(install(testFixture)).resolves.toBe('incompatibleCli');
        expect(testFixture.state.update).not.toHaveBeenCalled();
        await expect(install(testFixture)).resolves.toBe('installed');
        expect(run.mock.calls.filter((call) => call[1][0] === '--version')).toHaveLength(2);
        expect(testFixture.state.get(dotnetPluginCacheKey)).toMatchObject({ outcome: 'alreadyInstalled' });
    });

    test.each(['private output', 'GitHub Copilot CLI invalid.'])(
        'reports unrecognized version output %j as a version-stage failure',
        async (output) => {
            const testFixture = fixture();
            const { state, reporter, channel } = testFixture;
            parse.mockReturnValue([]);
            run.mockResolvedValueOnce('inventory').mockResolvedValueOnce(output);

            await expect(install(testFixture)).resolves.toBe('installFailed');
            expect(run.mock.calls.map((call) => call[1])).toEqual([['plugin', 'list'], ['--version']]);
            expect(state.update).not.toHaveBeenCalled();
            expect(channel.error).toHaveBeenCalledWith(
                'Copilot .NET plugin version failed',
                new Error('Unrecognized Copilot CLI version')
            );
            expect(reporter.sendTelemetryErrorEvent).toHaveBeenCalledWith(
                TelemetryEventNames.CopilotDotnetPluginError,
                {
                    stage: 'version',
                    operation: 'versionParse',
                    cliSource: 'standalone',
                    outcome: 'installFailed',
                    'error.name': 'Error',
                }
            );
            expect(JSON.stringify(reporter.sendTelemetryErrorEvent.mock.calls)).not.toContain('private output');
        }
    );

    test.each(['alreadyInstalled', 'alreadyInstalledDisabled', 'conflictingPlugin', 'conflictingMarketplace'])(
        'cached %s skips discovery and all CLI calls',
        async (outcome) => {
            const testFixture = fixture();
            const { state, reporter } = testFixture;
            state.values.set(dotnetPluginCacheKey, { extensionVersion: '1.2.3', outcome, source: 'app' });
            await expect(install(testFixture)).resolves.toBe(outcome);
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
        const testFixture = fixture();
        const { state } = testFixture;
        state.values.set(dotnetPluginCacheKey, {
            extensionVersion: '0.1.0',
            outcome: 'alreadyInstalled',
            source: 'app',
        });
        await install(testFixture);
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
        const testFixture = fixture();
        const { state } = testFixture;
        parse.mockReturnValue([existing]);
        await expect(install(testFixture)).resolves.toBe(outcome);
        expect(run).toHaveBeenCalledTimes(1);
        expect(state.get(dotnetPluginCacheKey)).toMatchObject({ outcome });
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    test('unavailable Copilot stays uncached and is rediscovered on the next activation', async () => {
        const testFixture = fixture();
        const { state, reporter } = testFixture;
        find.mockResolvedValueOnce(undefined);
        await expect(install(testFixture)).resolves.toBe('copilotNotAvailable');
        expect(run).not.toHaveBeenCalled();
        expect(state.update).not.toHaveBeenCalled();
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.CopilotDotnetPlugin, {
            outcome: 'copilotNotAvailable',
            source: 'none',
            cached: 'false',
        });
        await install(testFixture);
        expect(find).toHaveBeenCalledTimes(2);
        expect(run).toHaveBeenCalledTimes(1);
    });

    test.each(['autoInstallDisabled', 'aiDisabled', 'untrustedWorkspace'])(
        'cheap gate %s precedes the cache',
        async (outcome) => {
            const testFixture = fixture();
            const { state, reporter } = testFixture;
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
            await expect(install(testFixture)).resolves.toBe(outcome);
            expect(find).not.toHaveBeenCalled();
            expect(state.update).not.toHaveBeenCalled();
            expect(reporter.sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.CopilotDotnetPlugin, {
                outcome,
                source: 'none',
                cached: 'false',
            });
        }
    );

    test.each(['discovery', 'inventory', 'version', 'marketplace', 'install'])(
        'failure during %s is not cached',
        async (stage) => {
            const testFixture = fixture();
            const { state, reporter, channel } = testFixture;
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
                    if (stage === 'version' && args[0] === '--version') {
                        throw error;
                    }
                    if (stage === 'marketplace' && args[1] === 'marketplace') {
                        throw error;
                    }
                    if (args[1] === 'marketplace' && args[2] === 'list') {
                        return '[{"name":"dotnet-agent-skills","source":"GitHub: dotnet/skills"}]';
                    }
                    if (stage === 'install' && args[1] === 'install') {
                        throw error;
                    }
                    return cliOutput(args);
                });
            }
            await expect(install(testFixture)).resolves.toBe('installFailed');
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
        const testFixture = fixture();
        const { state, reporter } = testFixture;
        parse.mockReturnValueOnce([]);
        state.update.mockRejectedValueOnce(new Error('storage unavailable'));
        await expect(install(testFixture)).resolves.toBe('installFailed');
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledTimes(1);
        expect(reporter.sendTelemetryEvent.mock.calls[0][1]).toMatchObject({ outcome: 'installFailed' });
        expect(reporter.sendTelemetryErrorEvent.mock.calls[0][1]).toMatchObject({
            stage: 'cache',
            operation: 'cache',
            cliSource: 'standalone',
            outcome: 'installFailed',
            'error.name': 'Error',
        });
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    test('uses one overall timeout and cancels a running command', async () => {
        const testFixture = fixture();
        const { state, reporter } = testFixture;
        const started = deferred<vscode.CancellationToken>();
        run.mockImplementation(async (_cli, _args, commandToken) => {
            started.resolve(commandToken);
            return await new Promise<string>((_resolve, reject) => {
                commandToken.onCancellationRequested(() => reject(new vscode.CancellationError()));
            });
        });
        const pending = install(testFixture);
        const commandToken = await started.promise;
        await jest.advanceTimersByTimeAsync(120_000);
        await expect(pending).resolves.toBe('installFailed');
        expect(commandToken.isCancellationRequested).toBe(true);
        expect(state.update).not.toHaveBeenCalled();
        expect(reporter.sendTelemetryErrorEvent.mock.calls[0][1]).toEqual({
            stage: 'inventory',
            operation: 'pluginList',
            cliSource: 'standalone',
            outcome: 'installFailed',
            'error.name': 'TimeoutError',
        });
        expect(jest.getTimerCount()).toBe(0);
    });

    test.each(['version', 'install'])('deactivation cancels %s without reporting a failure', async (stage) => {
        const testFixture = fixture();
        const { context, state, reporter, channel } = testFixture;
        const started = deferred<vscode.CancellationToken>();
        parse.mockReturnValue([]);
        run.mockImplementation(async (_cli, args, commandToken) => {
            if (!(stage === 'version' ? args[0] === '--version' : args[1] === 'install')) {
                return cliOutput(args);
            }
            started.resolve(commandToken);
            return await new Promise<string>((_resolve, reject) => {
                commandToken.onCancellationRequested(() => reject(new vscode.CancellationError()));
            });
        });
        const pending = install(testFixture);
        const commandToken = await started.promise;
        context.subscriptions.forEach((subscription) => subscription.dispose());
        await expect(pending).resolves.toBeUndefined();
        expect(commandToken.isCancellationRequested).toBe(true);
        expect(state.update).not.toHaveBeenCalled();
        expect(channel.error).not.toHaveBeenCalled();
        expect(reporter.sendTelemetryEvent).not.toHaveBeenCalled();
        expect(reporter.sendTelemetryErrorEvent).not.toHaveBeenCalled();
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
    });
});

describe('Copilot .NET plugin diagnostic telemetry', () => {
    test.each<[string, string, string, cli.CopilotCliSource]>([
        ['plugin list', 'inventory', 'pluginList', 'standalone'],
        ['--version', 'version', 'version', 'app'],
        ['plugin marketplace list --json', 'marketplace', 'marketplaceList', 'standalone'],
        ['plugin marketplace add dotnet/skills', 'marketplace', 'marketplaceAdd', 'app'],
        ['plugin install dotnet@dotnet-agent-skills', 'install', 'pluginInstall', 'standalone'],
    ])('identifies failed command %s', async (command, stage, operation, source) => {
        const testFixture = fixture();
        find.mockResolvedValue({ ...runtime, source });
        parse.mockReturnValue([]);
        run.mockImplementation(async (_cli, args) => {
            if (args.join(' ') === command) {
                throw Object.assign(new Error('private command output'), { code: 23 });
            }
            return cliOutput(args);
        });

        await expect(install(testFixture)).resolves.toBe('installFailed');
        expect(testFixture.reporter.sendTelemetryErrorEvent).toHaveBeenCalledTimes(1);
        expect(testFixture.reporter.sendTelemetryErrorEvent).toHaveBeenCalledWith(
            TelemetryEventNames.CopilotDotnetPluginError,
            {
                stage,
                operation,
                cliSource: source,
                outcome: 'installFailed',
                'error.name': 'Error',
                exitCode: '23',
            }
        );
    });

    test.each([
        ['not JSON: private output', 'marketplaceParse', 'SyntaxError'],
        ['[{"name":"private-marketplace"}]', 'marketplaceValidate', 'Error'],
    ])('distinguishes marketplace parsing and validation for %j', async (output, operation, errorName) => {
        const testFixture = fixture();
        parse.mockReturnValue([]);
        run.mockImplementation(async (_cli, args) =>
            args[1] === 'marketplace' && args[2] === 'list' ? output : cliOutput(args)
        );

        await expect(install(testFixture)).resolves.toBe('installFailed');
        expect(testFixture.reporter.sendTelemetryErrorEvent).toHaveBeenCalledWith(
            TelemetryEventNames.CopilotDotnetPluginError,
            {
                stage: 'marketplace',
                operation,
                cliSource: 'standalone',
                outcome: 'installFailed',
                'error.name': errorName,
            }
        );
    });

    test.each([
        ['discovery', 'discovery', 'none'],
        ['inventory', 'pluginParse', 'standalone'],
    ])('does not treat %s errors as process failures', async (stage, operation, source) => {
        const testFixture = fixture();
        const error = Object.assign(new Error('private path'), { code: 'ENOENT' });
        if (stage === 'discovery') {
            find.mockRejectedValue(error);
        } else {
            parse.mockImplementation(() => {
                throw error;
            });
        }
        await expect(install(testFixture)).resolves.toBe('installFailed');
        expect(testFixture.reporter.sendTelemetryErrorEvent).toHaveBeenCalledWith(
            TelemetryEventNames.CopilotDotnetPluginError,
            {
                stage,
                operation,
                cliSource: source,
                outcome: 'installFailed',
                'error.name': 'Error',
            }
        );
    });

    test.each<[unknown, { processCode?: string; exitCode?: string }]>([
        ['ENOENT', { processCode: 'ENOENT' }],
        ['ERR_CHILD_PROCESS_STDIO_MAXBUFFER', { processCode: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }],
        ['private-token', { processCode: 'other' }],
        ['1', { processCode: 'other' }],
        [1, { exitCode: '1' }],
        [NaN, { processCode: 'other' }],
        [null, {}],
        [undefined, {}],
    ])('only emits safe structured properties for code %j', async (code, properties) => {
        const testFixture = fixture();
        const privateData = 'C:\\Users\\private-user https://private.example/repo?token=private-token';
        const error = Object.assign(
            new Error(privateData, {
                cause: Object.assign(new Error(privateData), { code: 'ENOENT' }),
            }),
            {
                code,
                stdout: privateData,
                stderr: privateData,
                path: privateData,
                stack: privateData,
            }
        );
        run.mockRejectedValue(error);

        await expect(install(testFixture)).resolves.toBe('installFailed');
        expect(testFixture.channel.error).toHaveBeenCalledWith('Copilot .NET plugin inventory failed', error);
        expect(testFixture.reporter.sendTelemetryErrorEvent).toHaveBeenCalledWith(
            TelemetryEventNames.CopilotDotnetPluginError,
            {
                stage: 'inventory',
                operation: 'pluginList',
                cliSource: 'standalone',
                outcome: 'installFailed',
                'error.name': 'Error',
                ...properties,
            }
        );
        expect(JSON.stringify(testFixture.reporter.sendTelemetryErrorEvent.mock.calls)).not.toContain('private');
        expect(JSON.stringify(testFixture.reporter.sendTelemetryEvent.mock.calls)).not.toContain('private');
    });
});

describe('Copilot .NET plugin registration', () => {
    test('starts automatic installation and owns its disposables', async () => {
        const { context, reporter, channel } = fixture();
        const pending = registerDotnetPlugin(context, reporter, channel);
        expect(find).toHaveBeenCalledTimes(1);
        await expect(pending).resolves.toBe('alreadyInstalled');
        context.subscriptions.forEach((subscription) => subscription.dispose());
    });

    test('test extension hosts never start automatic plugin operations', async () => {
        const { context, reporter, channel } = fixture();
        context.extensionMode = vscode.ExtensionMode.Test;
        await expect(registerDotnetPlugin(context, reporter, channel)).resolves.toBeUndefined();
        expect(find).not.toHaveBeenCalled();
        context.subscriptions.forEach((subscription) => subscription.dispose());
    });
});
