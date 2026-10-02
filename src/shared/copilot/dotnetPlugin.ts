/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { lt, parse as parseVersion } from 'semver';
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
const expectedMarketplaceSource = `GitHub: ${marketplaceSource}`;
const pluginSource = `dotnet@${marketplaceName}`;
const documentationUrl = 'https://github.com/dotnet/vscode-csharp/blob/main/docs/Copilot-Dotnet-Plugin.md';
const operationTimeoutMs = 120_000;
// Marketplace JSON output was introduced in https://github.com/github/copilot-cli/releases/tag/v1.0.84-4.
const minimumCliVersion = '1.0.84-4';
const processOperations = new Set<Operation>([
    'pluginList',
    'version',
    'marketplaceList',
    'marketplaceAdd',
    'pluginInstall',
]);
const allowedProcessCodes = new Set([
    'ENOENT',
    'EACCES',
    'EPERM',
    'ENOEXEC',
    'EAGAIN',
    'ENOMEM',
    'EMFILE',
    'ENFILE',
    'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
]);

type CachedOutcome = 'alreadyInstalled' | 'alreadyInstalledDisabled' | 'conflictingPlugin' | 'conflictingMarketplace';
type DisabledOutcome = 'autoInstallDisabled' | 'aiDisabled' | 'untrustedWorkspace';
type Outcome =
    CachedOutcome | 'installed' | 'copilotNotAvailable' | 'incompatibleCli' | DisabledOutcome | 'installFailed';
type Stage = 'configuration' | 'cache' | 'discovery' | 'inventory' | 'version' | 'marketplace' | 'install';
const operationStages = {
    configuration: 'configuration',
    cache: 'cache',
    discovery: 'discovery',
    pluginList: 'inventory',
    pluginParse: 'inventory',
    version: 'version',
    versionParse: 'version',
    marketplaceList: 'marketplace',
    marketplaceParse: 'marketplace',
    marketplaceValidate: 'marketplace',
    marketplaceAdd: 'marketplace',
    pluginInstall: 'install',
} satisfies Record<string, Stage>;
type Operation = keyof typeof operationStages;
type Source = CopilotCliSource | 'none';
type Cache = { extensionVersion: string; outcome: CachedOutcome; source: CopilotCliSource };
type InstallResult = {
    outcome: Exclude<Outcome, 'installFailed'>;
    source: Source;
    cached: boolean;
};

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

    let operation: Operation = 'configuration';
    let source: Source = 'none';
    let timedOut = false;
    const timeout = setTimeout(() => {
        timedOut = true;
        cancellation.cancel();
    }, operationTimeoutMs);

    try {
        const result = await install();
        report(host, result.outcome, result.source, result.cached);
        if (result.outcome === 'installed') {
            void showInstalled();
        }
        return result.outcome;
    } catch (error) {
        if (deactivated || (error instanceof vscode.CancellationError && !timedOut)) {
            return undefined;
        }

        const failure = timedOut ? named('TimeoutError', 'The Copilot CLI did not respond in time.') : error;
        reportError(host, operation, source, failure);
        report(host, 'installFailed', source, false);
        return 'installFailed';
    } finally {
        clearTimeout(timeout);
        cancellation.dispose();
    }

    async function install(): Promise<InstallResult> {
        // 1. Check whether configuration, AI settings, or workspace trust disable automatic installation.
        throwIfCancellationRequested(cancellation.token);
        const disabled = getDisabledOutcome();
        if (disabled) {
            host.channel.trace(`Copilot .NET plugin: Automatic installation skipped (${disabled}).`);
            return { outcome: disabled, source: 'none', cached: false };
        }

        // 2. Reuse a stable result already cached for this extension version.
        operation = 'cache';
        const cached = host.context.globalState.get<Cache>(dotnetPluginCacheKey);
        if (cached && cached.extensionVersion === host.context.extension.packageJSON.version) {
            host.channel.trace(
                `Copilot .NET plugin: Using cached result ${cached.outcome} from ${cached.source} source.`
            );
            return { outcome: cached.outcome, source: cached.source, cached: true };
        }

        // 3. Find a compatible Copilot CLI from either the standalone install or Copilot app.
        operation = 'discovery';
        const cli = await findCopilotCli();
        throwIfCancellationRequested(cancellation.token);
        if (!cli) {
            host.channel.trace('Copilot .NET plugin: No compatible Copilot CLI found.');
            return { outcome: 'copilotNotAvailable', source: 'none', cached: false };
        }

        source = cli.source;
        host.channel.trace(`Copilot .NET plugin: Using ${source} Copilot CLI source.`);

        // 4. Check for an existing supported plugin or a conflicting plugin with the same name.
        operation = 'pluginList';
        const pluginOutput = await runCopilotCli(cli, ['plugin', 'list'], cancellation.token);
        operation = 'pluginParse';
        const plugins = parsePluginList(pluginOutput);
        const existing = plugins.filter(isDotnetPlugin);
        let outcome: CachedOutcome | 'installed';
        if (existing.length > 0) {
            outcome = existing.some((plugin) => plugin.enabled) ? 'alreadyInstalled' : 'alreadyInstalledDisabled';
            host.channel.trace(`Copilot .NET plugin: Existing plugin found (${outcome}).`);
        } else if (plugins.some(isConflictingPlugin)) {
            outcome = 'conflictingPlugin';
            host.channel.info('Skipping Copilot .NET plugin installation: a plugin by that name is already installed.');
        } else {
            // 5. Check compatibility only when installation is needed, avoiding an extra CLI launch otherwise.
            operation = 'version';
            const output = await runCopilotCli(cli, ['--version'], cancellation.token);
            throwIfCancellationRequested(cancellation.token);
            operation = 'versionParse';
            // CLI output starts with a line such as "GitHub Copilot CLI 1.0.85.".
            const versionMatch = /^GitHub Copilot CLI (\S+?)\.?\r?$/m.exec(output);
            const version = parseVersion(versionMatch?.[1] ?? '');
            if (!version) {
                throw new Error('Unrecognized Copilot CLI version');
            }
            if (lt(version, minimumCliVersion)) {
                host.channel.info(
                    `Skipping Copilot .NET plugin installation: Copilot CLI ${version.version} is incompatible. Update the Copilot CLI or app to use CLI ${minimumCliVersion} or newer.`
                );
                return { outcome: 'incompatibleCli', source, cached: false };
            }

            // 6. Validate or register the expected marketplace, then install the plugin.
            if (!(await ensureMarketplace(cli))) {
                outcome = 'conflictingMarketplace';
            } else {
                operation = 'pluginInstall';
                host.channel.trace(`Copilot .NET plugin: Installing ${pluginSource} using ${source} source.`);
                await runCopilotCli(cli, ['plugin', 'install', pluginSource], cancellation.token);
                host.channel.trace(`Copilot .NET plugin: Installed ${pluginSource}.`);
                outcome = 'installed';
            }
        }

        // 7. Cache the stable result before returning it to the caller.
        operation = 'cache';
        await host.context.globalState.update(dotnetPluginCacheKey, {
            extensionVersion: host.context.extension.packageJSON.version,
            outcome: outcome === 'installed' ? 'alreadyInstalled' : outcome,
            source: cli.source,
        } satisfies Cache);
        throwIfCancellationRequested(cancellation.token);
        return { outcome, source, cached: false };
    }

    async function ensureMarketplace(cli: CopilotCli): Promise<boolean> {
        operation = 'marketplaceList';
        const output = await runCopilotCli(cli, ['plugin', 'marketplace', 'list', '--json'], cancellation.token);
        operation = 'marketplaceParse';
        const inventory: unknown = JSON.parse(output);
        operation = 'marketplaceValidate';
        if (
            !Array.isArray(inventory) ||
            !inventory.every(
                (marketplace): marketplace is { name: string; source: string } =>
                    typeof marketplace === 'object' &&
                    marketplace !== null &&
                    'name' in marketplace &&
                    typeof marketplace.name === 'string' &&
                    'source' in marketplace &&
                    typeof marketplace.source === 'string'
            )
        ) {
            throw new Error('Unrecognized Copilot marketplace inventory');
        }

        const marketplace = inventory.find((marketplace) => marketplace.name === marketplaceName);
        if (!marketplace) {
            operation = 'marketplaceAdd';
            host.channel.trace(`Copilot .NET plugin: Registering ${marketplaceName} marketplace.`);
            await runCopilotCli(cli, ['plugin', 'marketplace', 'add', marketplaceSource], cancellation.token);
            return true;
        }

        if (marketplace.source !== expectedMarketplaceSource) {
            host.channel.info(
                `Skipping Copilot .NET plugin installation: the ${marketplaceName} marketplace is registered from an unexpected source.`
            );
            return false;
        }

        return true;
    }
}

function getDisabledOutcome(): DisabledOutcome | undefined {
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

function report(host: DotnetPluginHost, outcome: Outcome, source: Source, cached: boolean): void {
    host.channel.trace(`Copilot .NET plugin result: ${outcome} (source: ${source}, cached: ${cached})`);
    host.reporter.sendTelemetryEvent(TelemetryEventNames.CopilotDotnetPlugin, {
        outcome,
        source,
        cached: String(cached),
    });
}

function reportError(host: DotnetPluginHost, operation: Operation, cliSource: Source, error: unknown): void {
    const stage = operationStages[operation];
    host.channel.error(`Copilot .NET plugin ${stage} failed`, error);
    const processProperties = processOperations.has(operation) ? processErrorProperties(error) : {};
    host.reporter.sendTelemetryErrorEvent(TelemetryEventNames.CopilotDotnetPluginError, {
        stage,
        operation,
        cliSource,
        outcome: 'installFailed',
        'error.name': telemetryErrorName(error),
        ...processProperties,
    });
}

function processErrorProperties(error: unknown): { processCode?: string; exitCode?: string } {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code === undefined || code === null) {
        return {};
    }

    if (typeof code === 'number' && Number.isSafeInteger(code)) {
        return { exitCode: String(code) };
    }

    // Only fixed Node/OS identifiers may leave the machine; never inspect messages, output, or causes.
    return { processCode: typeof code === 'string' && allowedProcessCodes.has(code) ? code : 'other' };
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
    return plugin.name === 'dotnet' || plugin.name.startsWith('dotnet@');
}

function telemetryErrorName(error: unknown): string {
    const allowedNames = ['Error', 'AbortError', 'TimeoutError', 'TypeError', 'RangeError', 'SyntaxError'];
    return error instanceof Error && allowedNames.includes(error.name) ? error.name : 'Error';
}
