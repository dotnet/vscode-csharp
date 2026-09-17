/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { commonOptions } from '../options';
import { ITelemetryReporter } from '../telemetryReporter';
import { TelemetryEventNames } from '../telemetryEventNames';
import type { CopilotCli, CopilotCliSource, CopilotPlugin } from './copilotCli';

export const uninstallDotnetPluginCommand = 'dotnet.copilot.uninstallDotnetPlugin';
export const dotnetPluginOptOutKey = 'csharp.copilotDotnetPlugin.autoInstallDisabled';
export const dotnetPluginCacheKey = 'csharp.copilotDotnetPlugin.checkResult';
const pluginSource = 'dotnet/skills:plugins/dotnet';
const documentationUrl = 'https://github.com/dotnet/vscode-csharp/blob/main/docs/Copilot-Dotnet-Plugin.md';
const operationTimeoutMs = 120_000;

type CachedOutcome = 'alreadyInstalled' | 'alreadyInstalledDisabled' | 'conflictingPlugin';
type Outcome =
    | CachedOutcome
    | 'installed'
    | 'copilotNotAvailable'
    | 'optedOut'
    | 'aiDisabled'
    | 'untrustedWorkspace'
    | 'uninstallRequested'
    | 'disposed'
    | 'installFailed'
    | 'uninstalled'
    | 'alreadyAbsent'
    | 'uninstallFailed';
type Stage = 'eligibility' | 'cache' | 'discovery' | 'inventory' | 'install' | 'confirmation' | 'optOut' | 'uninstall';
type Runtime = typeof import('./copilotCli');
type Context = {
    globalState: vscode.Memento;
    extension: Pick<vscode.Extension<unknown>, 'packageJSON'>;
};
type Channel = Pick<vscode.LogOutputChannel, 'error' | 'info'>;
type Cache = { extensionVersion: string; outcome: CachedOutcome; source: CopilotCliSource };
type Operation = {
    outcome: Outcome;
    source: CopilotCliSource | 'none';
    cached: boolean;
    stage: Stage;
    signal: AbortSignal;
};

export function registerDotnetPlugin(
    context: Context & Pick<vscode.ExtensionContext, 'subscriptions' | 'extensionMode'>,
    reporter: ITelemetryReporter,
    channel: Channel
): void {
    const manager = new DotnetPluginManager(context, reporter, channel);
    try {
        context.subscriptions.push(
            manager,
            vscode.commands.registerCommand(uninstallDotnetPluginCommand, async () => manager.uninstall())
        );
        // Other integration suites must not install into the developer's real Copilot profile.
        if (context.extensionMode !== vscode.ExtensionMode.Test) {
            const scheduled = setImmediate(() => {
                void manager.install();
            });
            context.subscriptions.push({ dispose: () => clearImmediate(scheduled) });
        }
    } catch (error) {
        manager.dispose();
        channel.error('Failed to register the Copilot .NET plugin integration', error);
    }
}

export class DotnetPluginManager implements vscode.Disposable {
    private pending = Promise.resolve();
    private installation: Promise<void> | undefined;
    private controller: AbortController | undefined;
    private disposed = false;
    private uninstallRequested = false;

    constructor(
        private readonly context: Context,
        private readonly reporter: ITelemetryReporter,
        private readonly channel: Channel
    ) {}

    public dispose(): void {
        this.disposed = true;
        this.controller?.abort(new Error('Copilot plugin operation disposed'));
    }

    public async install(): Promise<void> {
        this.installation ??= this.enqueue(async () => {
            const result = await this.operate(false, async (operation) => this.installCore(operation));
            if (result.outcome === 'installed' && !this.disposed && !this.uninstallRequested) {
                void this.showInstalled();
            }
        });
        await this.installation;
    }

    public async uninstall(): Promise<void> {
        this.uninstallRequested = true;
        // Start persisting the opt-out immediately, even if removal must wait for an active install.
        const optOut = this.persistOptOut();
        await this.enqueue(async () => {
            const result = await this.operate(true, async (operation) => {
                operation.stage = 'optOut';
                const persisted = await interruptible(optOut, operation.signal);
                if (!persisted.success) {
                    throw persisted.error;
                }
                await this.clearCache(operation);
                const runtime = await this.loadRuntime(operation);
                const cli = await this.discover(runtime, operation);
                if (!cli) {
                    operation.outcome = 'copilotNotAvailable';
                    return;
                }
                const plugins = await this.inventory(runtime, cli, operation, 'inventory');
                const targets = plugins.filter(isDotnetPlugin);
                if (targets.length === 0) {
                    if (plugins.some(isConflictingPlugin)) {
                        throw new Error('A different plugin uses the dotnet name; it has not been removed.');
                    }
                    operation.outcome = 'alreadyAbsent';
                    return;
                }
                for (const plugin of targets) {
                    operation.stage = 'uninstall';
                    operation.signal.throwIfAborted();
                    await runtime.runCopilotCli(cli, ['plugin', 'uninstall', plugin.name], operation.signal);
                }
                const remaining = await this.inventory(runtime, cli, operation, 'confirmation');
                if (remaining.some(isDotnetPlugin)) {
                    throw new Error('Copilot still lists the .NET plugin after uninstalling it.');
                }
                operation.outcome = 'uninstalled';
            });
            if (!this.disposed) {
                void this.showUninstallResult(result);
            }
        });
    }

    private async enqueue(work: () => Promise<void>): Promise<void> {
        const next = this.pending.then(work);
        // Keep the gate usable even if an unexpected failure escapes an operation's boundary.
        this.pending = next.catch((error) => {
            this.channel.error('Copilot .NET plugin operation failed', error);
        });
        await this.pending;
    }

    private async operate(uninstall: boolean, work: (operation: Operation) => Promise<void>): Promise<Operation> {
        const controller = new AbortController();
        this.controller = controller;
        const operation: Operation = {
            outcome: uninstall ? 'uninstallFailed' : 'installFailed',
            source: 'none',
            cached: false,
            stage: 'eligibility',
            signal: controller.signal,
        };
        const timeout = setTimeout(() => {
            const error = new Error('Copilot plugin operation timed out');
            error.name = 'TimeoutError';
            controller.abort(error);
        }, operationTimeoutMs);
        try {
            if (this.disposed) {
                operation.outcome = 'disposed';
            } else {
                await work(operation);
            }
        } catch (error) {
            operation.outcome = this.disposed ? 'disposed' : uninstall ? 'uninstallFailed' : 'installFailed';
            this.reportError(operation, controller.signal.aborted ? controller.signal.reason : error);
        } finally {
            clearTimeout(timeout);
            this.controller = undefined;
        }
        this.reportOutcome(operation, uninstall);
        return operation;
    }

    private async installCore(operation: Operation): Promise<void> {
        const skip = this.skipReason();
        if (skip) {
            operation.outcome = skip;
            return;
        }
        operation.stage = 'cache';
        const stored = this.context.globalState.get<unknown>(dotnetPluginCacheKey);
        if (isCache(stored) && stored.extensionVersion === this.context.extension.packageJSON.version) {
            operation.outcome = stored.outcome;
            operation.source = stored.source;
            operation.cached = true;
            return;
        }
        if (stored !== undefined) {
            await this.clearCache(operation);
        }
        const runtime = await this.loadRuntime(operation);
        const cli = await this.discover(runtime, operation);
        if (!cli) {
            operation.outcome = 'copilotNotAvailable';
            return;
        }
        const plugins = await this.inventory(runtime, cli, operation, 'inventory');
        const installed = plugins.filter(isDotnetPlugin);
        if (installed.length > 0) {
            operation.outcome = installed.some((plugin) => plugin.enabled)
                ? 'alreadyInstalled'
                : 'alreadyInstalledDisabled';
            await this.cache(operation, operation.outcome, cli.source);
            return;
        }
        if (plugins.some(isConflictingPlugin)) {
            operation.outcome = 'conflictingPlugin';
            this.channel.info('Skipping Copilot .NET plugin installation because a different plugin uses its name.');
            await this.cache(operation, operation.outcome, cli.source);
            return;
        }
        const lateSkip = this.skipReason();
        if (lateSkip) {
            operation.outcome = lateSkip;
            return;
        }
        operation.stage = 'install';
        operation.signal.throwIfAborted();
        await runtime.runCopilotCli(cli, ['plugin', 'install', pluginSource], operation.signal);
        const confirmed = (await this.inventory(runtime, cli, operation, 'confirmation')).filter(isDotnetPlugin);
        if (confirmed.length === 0) {
            throw new Error('Copilot did not list the .NET plugin after installation.');
        }
        operation.outcome = 'installed';
        await this.cache(
            operation,
            confirmed.some((plugin) => plugin.enabled) ? 'alreadyInstalled' : 'alreadyInstalledDisabled',
            cli.source
        );
    }

    private skipReason(): Outcome | undefined {
        if (this.disposed) {
            return 'disposed';
        }
        if (this.context.globalState.get<boolean>(dotnetPluginOptOutKey, false)) {
            return 'optedOut';
        }
        if (this.uninstallRequested) {
            return 'uninstallRequested';
        }
        if (commonOptions.disableAIFeatures) {
            return 'aiDisabled';
        }
        if (!vscode.workspace.isTrusted) {
            return 'untrustedWorkspace';
        }
        return undefined;
    }

    private async persistOptOut(): Promise<{ success: true } | { success: false; error: unknown }> {
        try {
            await this.context.globalState.update(dotnetPluginOptOutKey, true);
            return { success: true };
        } catch (error) {
            return { success: false, error };
        }
    }

    private async loadRuntime(operation: Operation): Promise<Runtime> {
        operation.stage = 'discovery';
        return await interruptible(import('./copilotCli'), operation.signal);
    }

    private async discover(runtime: Runtime, operation: Operation): Promise<CopilotCli | undefined> {
        operation.stage = 'discovery';
        const cli = await interruptible(runtime.findCopilotCli(operation.signal), operation.signal);
        operation.source = cli?.source ?? 'none';
        return cli;
    }

    private async inventory(
        runtime: Runtime,
        cli: CopilotCli,
        operation: Operation,
        stage: 'inventory' | 'confirmation'
    ): Promise<CopilotPlugin[]> {
        operation.stage = stage;
        operation.signal.throwIfAborted();
        // The runner observes cancellation and waits for its process to exit before releasing the gate.
        const output = await runtime.runCopilotCli(cli, ['plugin', 'list'], operation.signal);
        operation.signal.throwIfAborted();
        return runtime.parsePluginList(output);
    }

    private async clearCache(operation: Operation): Promise<void> {
        try {
            await interruptible(this.context.globalState.update(dotnetPluginCacheKey, undefined), operation.signal);
        } catch (error) {
            this.reportError({ ...operation, stage: 'cache' }, error);
            operation.signal.throwIfAborted();
        }
    }

    private async cache(operation: Operation, outcome: CachedOutcome, source: CopilotCliSource): Promise<void> {
        if (this.skipReason()) {
            return;
        }
        const value: Cache = {
            extensionVersion: this.context.extension.packageJSON.version,
            outcome,
            source,
        };
        try {
            await interruptible(this.context.globalState.update(dotnetPluginCacheKey, value), operation.signal);
        } catch (error) {
            this.reportError({ ...operation, stage: 'cache' }, error);
        }
    }

    private reportOutcome(operation: Operation, uninstall: boolean): void {
        try {
            const properties: Record<string, string> = { outcome: operation.outcome, source: operation.source };
            if (!uninstall) {
                properties.cached = String(operation.cached);
            }
            this.reporter.sendTelemetryEvent(
                uninstall ? TelemetryEventNames.CopilotDotnetPluginUninstall : TelemetryEventNames.CopilotDotnetPlugin,
                properties
            );
        } catch (error) {
            this.channel.error('Failed to report Copilot .NET plugin telemetry', error);
        }
    }

    private reportError(operation: Operation, error: unknown): void {
        this.channel.error(`Copilot .NET plugin ${operation.stage} failed`, error);
        try {
            this.reporter.sendTelemetryErrorEvent(TelemetryEventNames.CopilotDotnetPluginError, {
                stage: operation.stage,
                outcome: operation.outcome,
                'error.name': telemetryErrorName(error),
            });
        } catch (telemetryError) {
            this.channel.error('Failed to report Copilot .NET plugin error telemetry', telemetryError);
        }
    }

    private async showInstalled(): Promise<void> {
        try {
            const learnMore = vscode.l10n.t('Learn More');
            const selected = await vscode.window.showInformationMessage(
                vscode.l10n.t('Installed the C# LSP .NET plugin for GitHub Copilot'),
                learnMore
            );
            if (selected === learnMore && !this.disposed) {
                if (!(await vscode.env.openExternal(vscode.Uri.parse(documentationUrl)))) {
                    this.channel.error('Could not open the Copilot .NET plugin documentation.');
                }
            }
        } catch (error) {
            this.channel.error('Failed to show the Copilot .NET plugin notification or documentation', error);
        }
    }

    private async showUninstallResult(operation: Operation): Promise<void> {
        try {
            if (operation.outcome === 'uninstalled' || operation.outcome === 'alreadyAbsent') {
                await vscode.window.showInformationMessage(
                    operation.outcome === 'uninstalled'
                        ? vscode.l10n.t('Uninstalled the Copilot C# LSP plugin. Automatic installation is disabled.')
                        : vscode.l10n.t(
                              'The Copilot C# LSP plugin is not installed. Automatic installation is disabled.'
                          )
                );
            } else {
                await vscode.window.showWarningMessage(
                    operation.outcome === 'copilotNotAvailable'
                        ? vscode.l10n.t(
                              'Automatic installation is disabled, but Copilot is unavailable to uninstall the C# LSP plugin.'
                          )
                        : operation.stage === 'optOut'
                          ? vscode.l10n.t('Could not disable automatic installation. See the C# output for details.')
                          : vscode.l10n.t(
                                'Could not uninstall the Copilot C# LSP plugin. Automatic installation is disabled. See the C# output for details.'
                            )
                );
            }
        } catch (error) {
            this.channel.error('Failed to show the Copilot .NET plugin uninstall result', error);
        }
    }
}

function isDotnetPlugin(plugin: CopilotPlugin): boolean {
    return plugin.kind === 'installed' && (plugin.name === 'dotnet' || plugin.name === 'dotnet@dotnet-agent-skills');
}

function isConflictingPlugin(plugin: CopilotPlugin): boolean {
    return (plugin.name === 'dotnet' || plugin.name.startsWith('dotnet@')) && !isDotnetPlugin(plugin);
}

function isCache(value: unknown): value is Cache {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    return (
        'extensionVersion' in value &&
        typeof value.extensionVersion === 'string' &&
        'outcome' in value &&
        (value.outcome === 'alreadyInstalled' ||
            value.outcome === 'alreadyInstalledDisabled' ||
            value.outcome === 'conflictingPlugin') &&
        'source' in value &&
        (value.source === 'standalone' || value.source === 'app')
    );
}

function telemetryErrorName(error: unknown): string {
    const allowedNames = ['Error', 'AbortError', 'TimeoutError', 'TypeError', 'RangeError', 'SyntaxError'];
    return error instanceof Error && allowedNames.includes(error.name) ? error.name : 'Error';
}

async function interruptible<T>(work: PromiseLike<T>, signal: AbortSignal): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
        const aborted = () => reject(signal.reason);
        if (signal.aborted) {
            aborted();
        } else {
            signal.addEventListener('abort', aborted, { once: true });
        }
        void Promise.resolve(work)
            .then(resolve, reject)
            .finally(() => signal.removeEventListener('abort', aborted));
    });
}
