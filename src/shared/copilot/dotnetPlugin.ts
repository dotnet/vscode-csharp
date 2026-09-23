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
type BlockingOutcome = 'autoInstallDisabled' | 'aiDisabled' | 'untrustedWorkspace';
type Outcome = CachedOutcome | 'installed' | 'copilotNotAvailable' | BlockingOutcome | 'installFailed';
type Stage = 'configuration' | 'cache' | 'discovery' | 'inventory' | 'marketplace' | 'install';
type Source = CopilotCliSource | 'none';
type Cache = { extensionVersion: string; outcome: CachedOutcome; source: CopilotCliSource };

type DotnetPluginHost = {
    context: {
        globalState: vscode.Memento;
        extension: Pick<vscode.Extension<unknown>, 'packageJSON'>;
    };
    reporter: ITelemetryReporter;
    channel: Pick<vscode.LogOutputChannel, 'error' | 'info' | 'trace'>;
};

export async function registerDotnetPlugin(
    context: DotnetPluginHost['context'] & Pick<vscode.ExtensionContext, 'subscriptions' | 'extensionMode'>,
    reporter: ITelemetryReporter,
    channel: DotnetPluginHost['channel']
): Promise<Outcome | undefined> {
    const host: DotnetPluginHost = { context, reporter, channel };
    const cancellation = new vscode.CancellationTokenSource();
    let deactivated = false;
    context.subscriptions.push({
        dispose: () => {
            deactivated = true;
            cancellation.cancel();
            cancellation.dispose();
        },
    });

    // Other integration suites must not install into the developer's real Copilot profile.
    if (context.extensionMode === vscode.ExtensionMode.Test) {
        return undefined;
    }

    let stage: Stage = 'configuration';
    let source: Source = 'none';
    let timedOut = false;
    const timeout = setTimeout(() => {
        timedOut = true;
        cancellation.cancel();
    }, operationTimeoutMs);

    try {
        throwIfCancellationRequested(cancellation.token);
        const blocked = getBlockingOutcome();
        if (blocked) {
            host.channel.trace(`Copilot .NET plugin: Automatic installation skipped (${blocked}).`);
            report(host, TelemetryEventNames.CopilotDotnetPlugin, blocked, 'none', false);
            return blocked;
        }

        stage = 'cache';
        const cached = host.context.globalState.get<Cache>(dotnetPluginCacheKey);
        if (cached && cached.extensionVersion === host.context.extension.packageJSON.version) {
            host.channel.trace(
                `Copilot .NET plugin: Using cached result ${cached.outcome} from ${cached.source} source.`
            );
            report(host, TelemetryEventNames.CopilotDotnetPlugin, cached.outcome, cached.source, true);
            return cached.outcome;
        }

        stage = 'discovery';
        const cli = await findCopilotCli();
        throwIfCancellationRequested(cancellation.token);
        if (!cli) {
            host.channel.trace('Copilot .NET plugin: No compatible Copilot CLI found.');
            report(host, TelemetryEventNames.CopilotDotnetPlugin, 'copilotNotAvailable', 'none', false);
            return 'copilotNotAvailable';
        }

        source = cli.source;
        host.channel.trace(`Copilot .NET plugin: Using ${source} Copilot CLI source.`);
        stage = 'inventory';
        const plugins = parsePluginList(await runCopilotCli(cli, ['plugin', 'list'], cancellation.token));
        const existing = plugins.filter(isDotnetPlugin);
        if (existing.length > 0) {
            const outcome: CachedOutcome = existing.some((plugin) => plugin.enabled)
                ? 'alreadyInstalled'
                : 'alreadyInstalledDisabled';
            host.channel.trace(`Copilot .NET plugin: Existing plugin found (${outcome}).`);
            stage = 'cache';
            await host.context.globalState.update(dotnetPluginCacheKey, {
                extensionVersion: host.context.extension.packageJSON.version,
                outcome,
                source: cli.source,
            } satisfies Cache);
            throwIfCancellationRequested(cancellation.token);
            report(host, TelemetryEventNames.CopilotDotnetPlugin, outcome, source, false);
            return outcome;
        }

        if (plugins.some(isConflictingPlugin)) {
            host.channel.info('Skipping Copilot .NET plugin installation: a plugin by that name is already installed.');
            stage = 'cache';
            await host.context.globalState.update(dotnetPluginCacheKey, {
                extensionVersion: host.context.extension.packageJSON.version,
                outcome: 'conflictingPlugin',
                source: cli.source,
            } satisfies Cache);
            throwIfCancellationRequested(cancellation.token);
            report(host, TelemetryEventNames.CopilotDotnetPlugin, 'conflictingPlugin', source, false);
            return 'conflictingPlugin';
        }

        stage = 'marketplace';
        await ensureMarketplace(cli, cancellation.token, host);
        stage = 'install';
        host.channel.trace(`Copilot .NET plugin: Installing ${pluginSource} using ${source} source.`);
        await runCopilotCli(cli, ['plugin', 'install', pluginSource], cancellation.token);
        host.channel.trace(`Copilot .NET plugin: Installed ${pluginSource}.`);
        stage = 'cache';
        await host.context.globalState.update(dotnetPluginCacheKey, {
            extensionVersion: host.context.extension.packageJSON.version,
            outcome: 'alreadyInstalled',
            source: cli.source,
        } satisfies Cache);
        throwIfCancellationRequested(cancellation.token);
        report(host, TelemetryEventNames.CopilotDotnetPlugin, 'installed', source, false);
        void showInstalled();
        return 'installed';
    } catch (error) {
        if (deactivated || (error instanceof vscode.CancellationError && !timedOut)) {
            return undefined;
        }

        const failure = timedOut ? named('TimeoutError', 'The Copilot CLI did not respond in time.') : error;
        reportError(host, stage, 'installFailed', failure);
        report(host, TelemetryEventNames.CopilotDotnetPlugin, 'installFailed', source, false);
        return 'installFailed';
    } finally {
        clearTimeout(timeout);
        cancellation.dispose();
    }
}

function getBlockingOutcome(): BlockingOutcome | undefined {
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

async function ensureMarketplace(
    cli: CopilotCli,
    token: vscode.CancellationToken,
    host: DotnetPluginHost
): Promise<void> {
    const output = await runCopilotCli(cli, ['plugin', 'marketplace', 'list', '--json'], token);
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
        host.channel.trace(`Copilot .NET plugin: Registering ${marketplaceName} marketplace.`);
        await runCopilotCli(cli, ['plugin', 'marketplace', 'add', marketplaceSource], token);
    }
}

function report(
    host: DotnetPluginHost,
    event: TelemetryEventNames,
    outcome: Outcome,
    source: Source,
    cached: boolean
): void {
    host.channel.trace(`Copilot .NET plugin result: ${outcome} (source: ${source}, cached: ${cached})`);
    host.reporter.sendTelemetryEvent(event, {
        outcome,
        source,
        cached: String(cached),
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

function named(name: string, message: string): Error {
    return Object.assign(new Error(message), { name });
}

function throwIfCancellationRequested(token: vscode.CancellationToken): void {
    if (token.isCancellationRequested) {
        throw new vscode.CancellationError();
    }
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
