/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { commonOptions } from '../options';
import { ITelemetryReporter } from '../telemetryReporter';
import { TelemetryEventNames } from '../telemetryEventNames';
import {
    CopilotCli,
    CopilotCliSource,
    CopilotPlugin,
    findCopilotCli,
    parsePluginList,
    runCopilotCli,
} from './copilotCli';

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
    | 'cancelled'
    | 'installFailed'
    | 'uninstalled'
    | 'alreadyAbsent'
    | 'uninstallFailed';
type Stage = 'optOut' | 'cache' | 'discovery' | 'inventory' | 'install' | 'uninstall';
type Source = CopilotCliSource | 'none';
type Cache = { extensionVersion: string; outcome: CachedOutcome; source: CopilotCliSource };
type InstallResult = {
    outcome: Outcome;
    source: Source;
    cache?: Omit<Cache, 'extensionVersion'>;
};

export type DotnetPluginHost = {
    context: {
        globalState: vscode.Memento;
        extension: Pick<vscode.Extension<unknown>, 'packageJSON'>;
    };
    reporter: ITelemetryReporter;
    channel: Pick<vscode.LogOutputChannel, 'error' | 'info'>;
};

export function registerDotnetPlugin(
    context: DotnetPluginHost['context'] & Pick<vscode.ExtensionContext, 'subscriptions' | 'extensionMode'>,
    reporter: ITelemetryReporter,
    channel: DotnetPluginHost['channel']
): void {
    const host: DotnetPluginHost = { context, reporter, channel };
    const controller = new AbortController();
    // Other integration suites must not install into the developer's real Copilot profile.
    let operation =
        context.extensionMode === vscode.ExtensionMode.Test
            ? Promise.resolve()
            : installDotnetPlugin(host, controller.signal);
    context.subscriptions.push(
        { dispose: () => controller.abort(named('AbortError', 'The C# extension was deactivated.')) },
        vscode.commands.registerCommand(uninstallDotnetPluginCommand, async () => {
            operation = operation.then(async () => uninstallDotnetPlugin(host, controller.signal));
            await operation;
        })
    );
}

/**
 * Installs only when AI is enabled, the workspace is trusted, the user has not opted out, Copilot is available,
 * and no existing or conflicting .NET plugin is found. Stable results are cached per extension version.
 */
export async function installDotnetPlugin(host: DotnetPluginHost, signal: AbortSignal): Promise<void> {
    let stage: Stage = 'optOut';
    let source: Source = 'none';
    let done = () => {};
    try {
        const blocked = blockedReason(host.context);
        if (blocked) {
            report(host, TelemetryEventNames.CopilotDotnetPlugin, blocked, 'none', false);
            return;
        }

        stage = 'cache';
        const cached = readCache(host.context);
        if (cached) {
            report(host, TelemetryEventNames.CopilotDotnetPlugin, cached.outcome, cached.source, true);
            return;
        }

        stage = 'discovery';
        const deadlineResult = deadline(signal);
        const operation = deadlineResult.signal;
        done = deadlineResult.done;
        const cli = await findCopilotCli();
        if (!cli) {
            return await completeInstallation(host, { outcome: 'copilotNotAvailable', source: 'none' });
        }

        source = cli.source;
        stage = 'inventory';
        const plugins = await listPlugins(cli, operation);
        const existing = plugins.filter(isDotnetPlugin);
        if (existing.length > 0) {
            const outcome = enabledOutcome(existing);
            stage = 'cache';
            return await completeInstallation(host, {
                outcome,
                source,
                cache: { outcome, source: cli.source },
            });
        }

        if (plugins.some(isConflictingPlugin)) {
            host.channel.info('Skipping Copilot .NET plugin installation: another plugin uses its name.');
            stage = 'cache';
            return await completeInstallation(host, {
                outcome: 'conflictingPlugin',
                source,
                cache: { outcome: 'conflictingPlugin', source: cli.source },
            });
        }

        stage = 'install';
        await runCopilotCli(cli, ['plugin', 'install', pluginSource], operation);
        stage = 'cache';
        return await completeInstallation(host, {
            outcome: 'installed',
            source,
            cache: { outcome: 'alreadyInstalled', source: cli.source },
        });
    } catch (error) {
        const outcome = signal.aborted ? 'cancelled' : 'installFailed';
        const failure = signal.aborted ? signal.reason : error;
        reportError(host, stage, outcome, failure);
        finishInstallation(host, { outcome, source });
    } finally {
        done();
    }
}

async function completeInstallation(host: DotnetPluginHost, result: InstallResult): Promise<void> {
    if (result.cache) {
        await host.context.globalState.update(dotnetPluginCacheKey, {
            extensionVersion: host.context.extension.packageJSON.version,
            ...result.cache,
        } satisfies Cache);
    }
    finishInstallation(host, result);
}

function finishInstallation(host: DotnetPluginHost, result: InstallResult): void {
    report(host, TelemetryEventNames.CopilotDotnetPlugin, result.outcome, result.source, false);
    if (result.outcome === 'installed') {
        void showInstalled();
    }
}

export async function uninstallDotnetPlugin(host: DotnetPluginHost, signal: AbortSignal): Promise<void> {
    let stage: Stage = 'optOut';
    let outcome: Outcome;
    let source: Source = 'none';
    const { signal: operation, done } = deadline(signal);
    try {
        // Persist the opt-out first so that a failed removal still stops automatic installation.
        await host.context.globalState.update(dotnetPluginOptOutKey, true);
        stage = 'cache';
        await host.context.globalState.update(dotnetPluginCacheKey, undefined);
        stage = 'discovery';
        const cli = await findCopilotCli();
        source = cli?.source ?? 'none';
        if (!cli) {
            outcome = 'copilotNotAvailable';
        } else {
            stage = 'inventory';
            const plugins = await listPlugins(cli, operation);
            const targets = plugins.filter(isDotnetPlugin);
            if (targets.length === 0 && plugins.some(isConflictingPlugin)) {
                throw new Error('A different plugin uses the dotnet name; it has not been removed.');
            } else if (targets.length === 0) {
                outcome = 'alreadyAbsent';
            } else {
                stage = 'uninstall';
                for (const target of targets) {
                    await runCopilotCli(cli, ['plugin', 'uninstall', target.name], operation);
                }
                outcome = 'uninstalled';
            }
        }
    } catch (error) {
        outcome = signal.aborted ? 'cancelled' : 'uninstallFailed';
        reportError(host, stage, outcome, signal.aborted ? signal.reason : error);
    } finally {
        done();
    }

    report(host, TelemetryEventNames.CopilotDotnetPluginUninstall, outcome, source);
    void showUninstallResult(outcome, stage);
}

function blockedReason(context: DotnetPluginHost['context']): Outcome | undefined {
    if (context.globalState.get<boolean>(dotnetPluginOptOutKey, false)) {
        return 'optedOut';
    }
    if (commonOptions.disableAIFeatures) {
        return 'aiDisabled';
    }
    if (!vscode.workspace.isTrusted) {
        return 'untrustedWorkspace';
    }
    return undefined;
}

function readCache(context: DotnetPluginHost['context']): Cache | undefined {
    const cache = context.globalState.get<Cache>(dotnetPluginCacheKey);
    return cache?.extensionVersion === context.extension.packageJSON.version ? cache : undefined;
}

function deadline(signal: AbortSignal): { signal: AbortSignal; done: () => void } {
    const timer = new AbortController();
    const handle = setTimeout(
        () => timer.abort(named('TimeoutError', 'The Copilot CLI did not respond in time.')),
        operationTimeoutMs
    );
    return { signal: AbortSignal.any([signal, timer.signal]), done: () => clearTimeout(handle) };
}

async function listPlugins(cli: CopilotCli, signal: AbortSignal): Promise<CopilotPlugin[]> {
    return parsePluginList(await runCopilotCli(cli, ['plugin', 'list'], signal));
}

function enabledOutcome(plugins: CopilotPlugin[]): CachedOutcome {
    return plugins.some((plugin) => plugin.enabled) ? 'alreadyInstalled' : 'alreadyInstalledDisabled';
}

function report(
    host: DotnetPluginHost,
    event: TelemetryEventNames,
    outcome: Outcome,
    source: Source,
    cached?: boolean
): void {
    host.reporter.sendTelemetryEvent(event, {
        outcome,
        source,
        ...(cached === undefined ? {} : { cached: String(cached) }),
    });
}

function reportError(host: DotnetPluginHost, stage: Stage, outcome: Outcome, error: unknown): void {
    host.channel.error(`Copilot .NET plugin ${stage} failed`, error);
    host.reporter.sendTelemetryErrorEvent(TelemetryEventNames.CopilotDotnetPluginError, {
        stage,
        outcome,
        'error.name': telemetryErrorName(error),
    });
}

async function showInstalled(): Promise<void> {
    const learnMore = vscode.l10n.t('Learn More');
    const selected = await vscode.window.showInformationMessage(
        vscode.l10n.t('Installed the C# LSP .NET plugin for GitHub Copilot'),
        learnMore
    );
    if (selected === learnMore) {
        await vscode.env.openExternal(vscode.Uri.parse(documentationUrl));
    }
}

async function showUninstallResult(outcome: Outcome, stage: Stage): Promise<void> {
    if (outcome === 'uninstalled' || outcome === 'alreadyAbsent') {
        await vscode.window.showInformationMessage(
            outcome === 'uninstalled'
                ? vscode.l10n.t('Uninstalled the Copilot C# LSP plugin. Automatic installation is disabled.')
                : vscode.l10n.t('The Copilot C# LSP plugin is not installed. Automatic installation is disabled.'),
            { modal: true }
        );
    } else {
        await vscode.window.showWarningMessage(
            outcome === 'copilotNotAvailable'
                ? vscode.l10n.t(
                      'Automatic installation is disabled, but Copilot is unavailable to uninstall the C# LSP plugin.'
                  )
                : stage === 'optOut'
                  ? vscode.l10n.t('Could not disable automatic installation. See the C# output for details.')
                  : vscode.l10n.t(
                        'Could not uninstall the Copilot C# LSP plugin. Automatic installation is disabled. See the C# output for details.'
                    ),
            { modal: true }
        );
    }
}

function named(name: string, message: string): Error {
    return Object.assign(new Error(message), { name });
}

function isDotnetPlugin(plugin: CopilotPlugin): boolean {
    return plugin.kind === 'installed' && (plugin.name === 'dotnet' || plugin.name === 'dotnet@dotnet-agent-skills');
}

function isConflictingPlugin(plugin: CopilotPlugin): boolean {
    return (plugin.name === 'dotnet' || plugin.name.startsWith('dotnet@')) && !isDotnetPlugin(plugin);
}

function telemetryErrorName(error: unknown): string {
    const allowedNames = ['Error', 'AbortError', 'TimeoutError', 'TypeError', 'RangeError', 'SyntaxError'];
    return error instanceof Error && allowedNames.includes(error.name) ? error.name : 'Error';
}
