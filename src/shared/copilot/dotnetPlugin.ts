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

export const dotnetPluginAutoInstallKey = 'dotnet.copilotDotnetPlugin.enableAutoInstall';
export const dotnetPluginCacheKey = 'csharp.copilotDotnetPlugin.checkResult';
const marketplaceName = 'dotnet-agent-skills';
const marketplaceSource = 'dotnet/skills';
const pluginSource = `dotnet@${marketplaceName}`;
const documentationUrl = 'https://github.com/dotnet/vscode-csharp/blob/main/docs/Copilot-Dotnet-Plugin.md';
const operationTimeoutMs = 120_000;

type CachedOutcome = 'alreadyInstalled' | 'alreadyInstalledDisabled' | 'conflictingPlugin';
type Outcome =
    | CachedOutcome
    | 'installed'
    | 'copilotNotAvailable'
    | 'autoInstallDisabled'
    | 'aiDisabled'
    | 'untrustedWorkspace'
    | 'cancelled'
    | 'installFailed';
type Stage = 'configuration' | 'cache' | 'discovery' | 'inventory' | 'marketplace' | 'install';
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
    channel: Pick<vscode.LogOutputChannel, 'error' | 'info' | 'trace'>;
};

export function registerDotnetPlugin(
    context: DotnetPluginHost['context'] & Pick<vscode.ExtensionContext, 'subscriptions' | 'extensionMode'>,
    reporter: ITelemetryReporter,
    channel: DotnetPluginHost['channel']
): void {
    const host: DotnetPluginHost = { context, reporter, channel };
    const controller = new AbortController();
    // Other integration suites must not install into the developer's real Copilot profile.
    if (context.extensionMode !== vscode.ExtensionMode.Test) {
        void installDotnetPlugin(host, controller.signal);
    }
    context.subscriptions.push({
        dispose: () => controller.abort(named('AbortError', 'The C# extension was deactivated.')),
    });
}

/**
 * Installs only when automatic installation and AI are enabled, the workspace is trusted, Copilot is available,
 * and no existing or conflicting .NET plugin is found. Stable results are cached per extension version.
 */
export async function installDotnetPlugin(host: DotnetPluginHost, signal: AbortSignal): Promise<void> {
    let stage: Stage = 'configuration';
    let source: Source = 'none';
    let done = () => {};
    try {
        const blocked = blockedReason();
        if (blocked) {
            trace(host, `Automatic installation skipped (${blocked}).`);
            report(host, TelemetryEventNames.CopilotDotnetPlugin, blocked, 'none', false);
            return;
        }

        stage = 'cache';
        const cached = readCache(host.context);
        if (cached) {
            trace(host, `Using cached result ${cached.outcome} from ${cached.source} source.`);
            report(host, TelemetryEventNames.CopilotDotnetPlugin, cached.outcome, cached.source, true);
            return;
        }

        stage = 'discovery';
        const deadlineResult = deadline(signal);
        const operation = deadlineResult.signal;
        done = deadlineResult.done;
        const cli = await findCopilotCli();
        if (!cli) {
            trace(host, 'No compatible Copilot CLI found.');
            return await completeInstallation(host, { outcome: 'copilotNotAvailable', source: 'none' });
        }

        source = cli.source;
        trace(host, `Using ${source} Copilot CLI source.`);
        stage = 'inventory';
        const plugins = await listPlugins(cli, operation);
        const existing = plugins.filter(isDotnetPlugin);
        if (existing.length > 0) {
            const outcome = enabledOutcome(existing);
            trace(host, `Existing plugin found (${outcome}).`);
            stage = 'cache';
            return await completeInstallation(host, {
                outcome,
                source,
                cache: { outcome, source: cli.source },
            });
        }

        if (plugins.some(isConflictingPlugin)) {
            host.channel.info('Skipping Copilot .NET plugin installation: a plugin by that name is already installed.');
            stage = 'cache';
            return await completeInstallation(host, {
                outcome: 'conflictingPlugin',
                source,
                cache: { outcome: 'conflictingPlugin', source: cli.source },
            });
        }

        stage = 'marketplace';
        await ensureMarketplace(cli, operation, host);
        stage = 'install';
        trace(host, `Installing ${pluginSource} using ${source} source.`);
        await runCopilotCli(cli, ['plugin', 'install', pluginSource], operation);
        trace(host, `Installed ${pluginSource}.`);
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
        trace(host, `Caching ${result.cache.outcome} result for ${result.cache.source} source.`);
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

function blockedReason(): Outcome | undefined {
    if (!vscode.workspace.getConfiguration().get(dotnetPluginAutoInstallKey, true)) {
        return 'autoInstallDisabled';
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

async function ensureMarketplace(cli: CopilotCli, signal: AbortSignal, host: DotnetPluginHost): Promise<void> {
    const output = await runCopilotCli(cli, ['plugin', 'marketplace', 'list', '--json'], signal);
    const inventory: unknown = JSON.parse(output);
    if (!Array.isArray(inventory)) {
        throw new Error('Unrecognized Copilot marketplace inventory');
    }

    const names: string[] = [];
    for (const marketplace of inventory) {
        if (
            typeof marketplace !== 'object' ||
            marketplace === null ||
            !('name' in marketplace) ||
            typeof marketplace.name !== 'string'
        ) {
            throw new Error('Unrecognized Copilot marketplace inventory');
        }
        names.push(marketplace.name);
    }

    if (!names.includes(marketplaceName)) {
        trace(host, `Registering ${marketplaceName} marketplace.`);
        await runCopilotCli(cli, ['plugin', 'marketplace', 'add', marketplaceSource], signal);
    }
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
    host.channel.trace(`Copilot .NET plugin result: ${outcome} (source: ${source}, cached: ${cached ?? false})`);
    host.reporter.sendTelemetryEvent(event, {
        outcome,
        source,
        ...(cached === undefined ? {} : { cached: String(cached) }),
    });
}

function trace(host: DotnetPluginHost, message: string): void {
    host.channel.trace(`Copilot .NET plugin: ${message}`);
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
