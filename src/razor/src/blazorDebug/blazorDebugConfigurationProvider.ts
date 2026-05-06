/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import execa from 'execa';
import { promises, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import * as vscode from 'vscode';
import { ChromeBrowserFinder, EdgeBrowserFinder } from '@vscode/js-debug-browsers';
import { RazorLogger } from '../razorLogger';
import { ONLY_JS_DEBUG_NAME, MANAGED_DEBUG_NAME, JS_DEBUG_NAME, SERVER_APP_NAME } from './constants';
import { isValidEvent, onDidTerminateDebugSession } from './terminateDebugHandler';
import path = require('path');
import * as cp from 'child_process';
import { getExtensionPath } from '../../../common';
import { debugSessionTracker } from '../../../coreclrDebug/provisionalDebugSessionTracker';
import { getCSharpDevKit } from '../../../utils/getCSharpDevKit';
import { CSharpExtensionId } from '../../../constants/csharpExtensionId';
import { DotNetRuntimeVersion } from '../../../lsptoolshost/dotnetRuntime/dotnetRuntimeExtensionResolver';
import {
    IDotnetAcquireContext,
    IDotnetAcquireResult,
    IDotnetFindPathContext,
} from '../../../lsptoolshost/dotnetRuntime/dotnetRuntimeExtensionApi';
import { IDisposable } from '@microsoft/servicehub-framework';
import { Observer } from '@microsoft/servicehub-framework/js/src/jsonRpc/Observer';
import { EventEmitter } from 'events';
import {
    Formatters,
    MessageDelimiters,
    ServiceJsonRpcDescriptor,
    ServiceMoniker,
    ServiceRpcDescriptor,
} from '@microsoft/servicehub-framework';

interface IDebugTargetFrameworkService {
    subscribe(observer: Observer<ProjectDebugTargetFrameworkInfo[]>): Promise<IDisposable>;
}

interface ProjectDebugTargetFrameworkInfo {
    fullPath: string;
    debugTargetFramework: string | undefined;
    availableTargetFrameworks: FrameworkInfo[];
}

interface FrameworkInfo {
    framework: string;
    displayName: string;
}

const targetFrameworkServiceDescriptor: ServiceRpcDescriptor = Object.freeze(
    new ServiceJsonRpcDescriptor(
        ServiceMoniker.create('Microsoft.VisualStudio.ProjectSystem.DebugTargetFrameworkService', '0.1'),
        Formatters.Utf8,
        MessageDelimiters.HttpLikeHeaders,
        {
            protocolMajorVersion: 3,
        }
    )
);

import { ActionOption, showErrorMessage, showInformationMessage } from '../../../shared/observers/utils/showMessage';

export class BlazorDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    private static readonly autoDetectUserNotice: string = vscode.l10n.t(
        'Run and Debug: auto-detection found {0} for a launch browser'
    );
    private static readonly edgeBrowserType: string = 'msedge';
    private static readonly chromeBrowserType: string = 'chrome';
    private static readonly pidsByUrl = new Map<string, number | undefined>();
    private static readonly vsWebAssemblyBridgeOutputChannel = vscode.window.createOutputChannel('VsWebAssemblyBridge');

    // Session tracking: captures sessions started during a Blazor debug launch
    // so they can all be torn down together when any one terminates.
    // Static because tryToUseVSDbgForMono (called by C# Dev Kit) is static.
    private static isTrackingSessions = false;
    private static readonly trackedSessionIds = new Set<string>();
    private static readonly trackedSessionsById = new Map<string, vscode.DebugSession>();

    constructor(private readonly logger: RazorLogger, private readonly vscodeType: typeof vscode) {}

    public static register(logger: RazorLogger, vscodeType: typeof vscode) {
        const provider = new BlazorDebugConfigurationProvider(logger, vscodeType);
        const disposables: vscode.Disposable[] = [];

        disposables.push(vscodeType.debug.registerDebugConfigurationProvider('blazorwasm', provider));

        // Track sessions started during our Blazor launch sequence.
        disposables.push(
            vscodeType.debug.onDidStartDebugSession((session) => {
                if (BlazorDebugConfigurationProvider.isTrackingSessions) {
                    BlazorDebugConfigurationProvider.trackedSessionIds.add(session.id);
                    BlazorDebugConfigurationProvider.trackedSessionsById.set(session.id, session);
                }
            })
        );

        // When any tracked session terminates, stop all remaining siblings.
        disposables.push(
            vscodeType.debug.onDidTerminateDebugSession(async (event) => {
                if (!BlazorDebugConfigurationProvider.trackedSessionIds.has(event.id)) {
                    return;
                }
                BlazorDebugConfigurationProvider.isTrackingSessions = false;
                BlazorDebugConfigurationProvider.trackedSessionIds.delete(event.id);
                BlazorDebugConfigurationProvider.trackedSessionsById.delete(event.id);
                const sessionsToStop = [...BlazorDebugConfigurationProvider.trackedSessionsById.values()];
                BlazorDebugConfigurationProvider.trackedSessionIds.clear();
                BlazorDebugConfigurationProvider.trackedSessionsById.clear();
                for (const session of sessionsToStop) {
                    await vscodeType.debug.stopDebugging(session);
                }
            })
        );

        return vscode.Disposable.from(...disposables);
    }

    public async resolveDebugConfiguration(
        folder: vscode.WorkspaceFolder | undefined,
        configuration: vscode.DebugConfiguration
    ): Promise<vscode.DebugConfiguration | undefined> {
        // Enable session tracking so that onDidStartDebugSession captures
        // every session launched as part of this Blazor debug sequence.
        // Tracking stays on until the first tracked session terminates,
        // because sessions may start asynchronously after startDebugging resolves.
        BlazorDebugConfigurationProvider.trackedSessionIds.clear();
        BlazorDebugConfigurationProvider.trackedSessionsById.clear();
        BlazorDebugConfigurationProvider.isTrackingSessions = true;

        /**
         * The Blazor WebAssembly app should only be launched if the
         * launch configuration is a launch request. Attach requests will
         * only launch the browser.
         */
        if (configuration.request === 'launch') {
            await this.launchApp(folder, configuration);
        }

        let inspectUri =
            '{wsProtocol}://{url.hostname}:{url.port}/_framework/debug/ws-proxy?browser={browserInspectUri}';
        let url = 'https://localhost:5001';
        try {
            if (folder !== undefined) {
                let folderPath = configuration.cwd ? configuration.cwd : fileURLToPath(folder.uri.toString());
                folderPath = folderPath.replace('${workspaceFolder}', fileURLToPath(folder.uri.toString()));
                const launchSettings = JSON.parse(
                    readFileSync(join(folderPath, 'Properties', 'launchSettings.json'), 'utf8')
                );
                if (
                    launchSettings?.profiles &&
                    launchSettings?.profiles[Object.keys(launchSettings.profiles)[0]]?.inspectUri
                ) {
                    inspectUri = launchSettings.profiles[Object.keys(launchSettings.profiles)[0]].inspectUri;
                    url = launchSettings.profiles[Object.keys(launchSettings.profiles)[0]].applicationUrl.split(
                        ';',
                        1
                    )[0];
                }
            }
        } catch (error: any) {
            this.logger.logError(
                '[DEBUGGER] Error while getting information from launchSettings.json: ',
                error as Error
            );
        }

        await this.launchBrowser(folder, configuration, inspectUri, url);

        /**
         * If `resolveDebugConfiguration` returns undefined, then the debugger
         * launch is canceled. Here, we opt to manually launch the browser
         * configuration using `startDebugging` above instead of returning
         * the configuration to avoid a bug where VS Code is unable to resolve
         * the debug adapter for the browser debugger.
         */
        return undefined;
    }

    private async launchApp(folder: vscode.WorkspaceFolder | undefined, configuration: vscode.DebugConfiguration) {
        const program = configuration.hosted ? configuration.program : 'dotnet';
        const cwd = configuration.cwd || '${workspaceFolder}';
        const args = configuration.hosted ? [] : ['run'];

        const app = {
            name: SERVER_APP_NAME,
            type: 'coreclr',
            request: 'launch',
            prelaunchTask: 'build',
            program,
            args,
            cwd,
            env: {
                ASPNETCORE_ENVIRONMENT: 'Development',
                DOTNET_MODIFIABLE_ASSEMBLIES: 'debug',
                ...configuration.env,
            },
            launchBrowser: {
                enabled: false,
            },
            cascadeTerminateToConfigurations: [ONLY_JS_DEBUG_NAME, MANAGED_DEBUG_NAME, JS_DEBUG_NAME],
            ...configuration.dotNetConfig,
        };

        try {
            await this.vscodeType.debug.startDebugging(folder, app);
            if (process.platform !== 'win32') {
                const terminate = this.vscodeType.debug.onDidTerminateDebugSession(async (event) => {
                    if (!isValidEvent(event.name)) {
                        return;
                    }
                    const blazorDevServer = 'blazor-devserver\\.dll';
                    const dir = folder && folder.uri && folder.uri.fsPath;
                    const regexEscapedDir = dir!.toLowerCase()!.replace(/\//g, '\\/');
                    const launchedApp = configuration.hosted
                        ? app.program
                        : `${regexEscapedDir}.*${blazorDevServer}|${blazorDevServer}.*${regexEscapedDir}`;
                    await onDidTerminateDebugSession(event, this.logger, launchedApp);
                    terminate.dispose();
                });
            }
        } catch (error) {
            this.logger.logError('[DEBUGGER] Error when launching application: ', error as Error);
        }
    }

    private async launchBrowser(
        folder: vscode.WorkspaceFolder | undefined,
        configuration: vscode.DebugConfiguration,
        inspectUri: string,
        url: string
    ) {
        const originalInspectUri = inspectUri;
        let folderPath = configuration.cwd;
        if (folder && folderPath) {
            folderPath = folderPath.replace('${workspaceFolder}', fileURLToPath(folder.uri.toString()));
            folderPath = folderPath.replaceAll(/[\\/]/g, path.sep);
        }
        const useVSDbg = await BlazorDebugConfigurationProvider.useVSDbg(folderPath ? folderPath : '');
        let portBrowserDebug = -1;
        if (useVSDbg) {
            [inspectUri, portBrowserDebug] = await this.attachToAppOnBrowser(folder, configuration, url);
        }

        const configBrowser = configuration.browser;
        const browserType =
            configBrowser === 'edge'
                ? BlazorDebugConfigurationProvider.edgeBrowserType
                : configBrowser === 'chrome'
                ? BlazorDebugConfigurationProvider.chromeBrowserType
                : await BlazorDebugConfigurationProvider.determineBrowserType();
        if (!browserType) {
            return;
        }

        const browser = {
            name: useVSDbg ? ONLY_JS_DEBUG_NAME : JS_DEBUG_NAME,
            type: browserType,
            request: 'launch',
            timeout: configuration.timeout || 30000,
            url: configuration.url || url,
            webRoot: configuration.webRoot || '${workspaceFolder}',
            inspectUri,
            trace: configuration.trace || false,
            noDebug: configuration.noDebug || false,
            ...configuration.browserConfig,
            // When the browser debugging session is stopped, propogate
            // this and terminate the debugging session of the Blazor dev server.
            cascadeTerminateToConfigurations: [SERVER_APP_NAME, MANAGED_DEBUG_NAME],
        };

        if (useVSDbg) {
            browser.port = portBrowserDebug;
        }

        const monovsdbgSession = debugSessionTracker.getDebugSessionByType('monovsdbg_wasm');
        if (useVSDbg) {
            //means that we don't have c#devkit installed so we get information from configSettings
            if (monovsdbgSession === undefined && getCSharpDevKit() === undefined) {
                //something wrong happened kill the vswebassembly and use the older debugger
                browser.inspectUri = originalInspectUri;
                browser.port = undefined;
                const oldPid = BlazorDebugConfigurationProvider.pidsByUrl.get(browser.url);
                if (oldPid !== undefined && oldPid > 0) {
                    try {
                        process.kill(oldPid);
                    } catch {
                        // Process may have already terminated
                    }
                }
            }
        }

        try {
            /**
             * The browser debugger will immediately launch after the
             * application process is started. It waits a `timeout`
             * interval before crashing after being unable to find the launched
             * process.
             *
             * We do this to provide immediate visual feedback to the user
             * that their debugger session has started.
             */
            await this.vscodeType.debug.startDebugging(folder, browser);
        } catch (error) {
            this.logger.logError('[DEBUGGER] Error when launching browser debugger: ', error as Error);
            const message = vscode.l10n.t(
                'There was an unexpected error while launching your debugging session. Check the console for helpful logs and visit the debugging docs for more info.'
            );
            const viewDebugDocsButton: ActionOption = {
                title: vscode.l10n.t('View Debug Docs'),
                action: async () => {
                    const debugDocsUri = 'https://aka.ms/blazorwasmcodedebug';
                    await this.vscodeType.commands.executeCommand(`vcode.open`, debugDocsUri);
                },
            };
            const ignoreButton = vscode.l10n.t('Ignore');
            showErrorMessage(this.vscodeType, message, viewDebugDocsButton, ignoreButton);
        }
    }

    private async attachToAppOnBrowser(
        folder: vscode.WorkspaceFolder | undefined,
        configuration: vscode.DebugConfiguration,
        url: string
    ): Promise<[string, number]> {
        const [inspectUriRet, portICorDebug, portBrowserDebug] =
            await BlazorDebugConfigurationProvider.launchVsWebAssemblyBridge(configuration.url || url);

        const cwd = configuration.cwd || '${workspaceFolder}';
        const args = configuration.hosted ? [] : ['run'];
        const app = {
            name: MANAGED_DEBUG_NAME,
            type: 'monovsdbg_wasm',
            request: 'launch',
            args,
            cwd,
            cascadeTerminateToConfigurations: [ONLY_JS_DEBUG_NAME, SERVER_APP_NAME, JS_DEBUG_NAME],
            ...configuration.dotNetConfig,
        };

        app.monoDebuggerOptions = {
            ip: '127.0.0.1',
            port: portICorDebug,
            platform: 'browser',
            isServer: true,
        };

        try {
            await this.vscodeType.debug.startDebugging(folder, app);

            const terminate = this.vscodeType.debug.onDidTerminateDebugSession(async (event) => {
                if (!isValidEvent(event.name)) {
                    return;
                }
                if (process.platform !== 'win32') {
                    const blazorDevServer = 'blazor-devserver\\.dll';
                    const dir = folder?.uri?.fsPath;
                    if (dir) {
                        const regexEscapedDir = dir.toLowerCase().replace(/\//g, '\\/');
                        const launchedApp = configuration.hosted
                            ? app.program
                            : `${regexEscapedDir}.*${blazorDevServer}|${blazorDevServer}.*${regexEscapedDir}`;
                        await onDidTerminateDebugSession(event, this.logger, launchedApp);
                    }
                }
                terminate.dispose();
            });
        } catch (error) {
            this.logger.logError('[DEBUGGER] Error when launching application: ', error as Error);
        }
        return [inspectUriRet, portBrowserDebug];
    }

    /**
     * Acquires the dotnet runtime path from the .NET Runtime extension,
     * falling back to the global dotnet if the extension is unavailable.
     */
    private static async acquireDotnetPath(): Promise<string> {
        const findPathRequest: IDotnetFindPathContext = {
            acquireContext: {
                version: DotNetRuntimeVersion,
                requestingExtensionId: CSharpExtensionId,
                architecture: process.arch,
                mode: 'aspnetcore',
            },
            versionSpecRequirement: 'greater_than_or_equal',
            rejectPreviews: true,
        };

        try {
            let acquireResult = await vscode.commands.executeCommand<IDotnetAcquireResult | undefined>(
                'dotnet.findPath',
                findPathRequest
            );
            if (acquireResult === undefined) {
                const acquireContext: IDotnetAcquireContext = {
                    version: DotNetRuntimeVersion.substring(0, DotNetRuntimeVersion.lastIndexOf('.')),
                    requestingExtensionId: CSharpExtensionId,
                    mode: 'aspnetcore',
                };
                acquireResult = await vscode.commands.executeCommand<IDotnetAcquireResult>(
                    'dotnet.acquire',
                    acquireContext
                );
            }
            if (acquireResult?.dotnetPath) {
                return acquireResult.dotnetPath;
            }
        } catch {
            // Fall through to global dotnet
        }

        return process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';
    }

    private static async launchVsWebAssemblyBridge(urlStr: string): Promise<[string, number, number]> {
        const dotnetPath = await BlazorDebugConfigurationProvider.acquireDotnetPath();
        const devToolsUrl = `http://localhost:0`; // Browser debugging port address
        const spawnedProxyArgs = [
            `${BlazorDebugConfigurationProvider.getWebAssemblyWebBridgePath()}`,
            '--DevToolsUrl',
            `${devToolsUrl}`,
            '--UseVsDbg',
            'true',
            '--iCorDebugPort',
            '-1',
            '--OwnerPid',
            `${process.pid}`,
        ];
        const cpOptions: cp.SpawnOptionsWithoutStdio = {
            detached: true,
            windowsHide: true,
            env: {
                ...process.env,
                DOTNET_ROOT: path.dirname(dotnetPath),
                DOTNET_MULTILEVEL_LOOKUP: '0',
            },
        };
        let chunksProcessed = 0;
        let proxyICorDebugPort = -1;
        let proxyBrowserPort = -1;
        let newUri = '';
        const spawnedProxy = cp.spawn(dotnetPath, spawnedProxyArgs, cpOptions);
        const eventEmmiter = new EventEmitter();
        spawnedProxy.on('error', (err) => {
            BlazorDebugConfigurationProvider.vsWebAssemblyBridgeOutputChannel.appendLine(
                `Failed to spawn proxy: ${err.message}`
            );
            eventEmmiter.emit('vsWebAssemblyReady');
        });
        spawnedProxy.on('close', (code) => {
            if (newUri === '') {
                BlazorDebugConfigurationProvider.vsWebAssemblyBridgeOutputChannel.appendLine(
                    `Proxy process exited with code ${code} before it was ready`
                );
                eventEmmiter.emit('vsWebAssemblyReady');
            }
        });
        function handleData(stream: NodeJS.ReadableStream) {
            stream.on('data', (chunk) => {
                BlazorDebugConfigurationProvider.vsWebAssemblyBridgeOutputChannel.appendLine(chunk.toString());
                if (newUri != '') {
                    return;
                }
                if (chunksProcessed++ > 10) {
                    eventEmmiter.emit('vsWebAssemblyReady');
                }
                const matchExprProxyUrl = 'Now listening on: (?<url>.*)';
                const matchExprICorDebugPort = 'Listening iCorDebug on: (?<port>.*)';
                const matchExprBrowserPort = 'Waiting for browser on: (?<port>.*)';
                const foundProxyUrl = `${chunk}`.match(matchExprProxyUrl);
                const foundICorDebugPort = `${chunk}`.match(matchExprICorDebugPort);
                const foundBrowserPort = `${chunk}`.match(matchExprBrowserPort);
                const proxyUrlString = foundProxyUrl?.groups?.url;
                if (foundICorDebugPort?.groups?.port != undefined) {
                    proxyICorDebugPort = Number(foundICorDebugPort?.groups?.port);
                }
                if (foundBrowserPort?.groups?.port != undefined) {
                    proxyBrowserPort = Number(foundBrowserPort?.groups?.port);
                }
                if (proxyUrlString) {
                    BlazorDebugConfigurationProvider.vsWebAssemblyBridgeOutputChannel.appendLine(
                        `Debugging proxy is running at: ${proxyUrlString}`
                    );
                    const oldPid = BlazorDebugConfigurationProvider.pidsByUrl.get(urlStr);
                    if (oldPid !== undefined && oldPid > 0) {
                        try {
                            process.kill(oldPid);
                        } catch {
                            // Process may have already terminated
                        }
                    }
                    if (spawnedProxy.pid !== undefined) {
                        BlazorDebugConfigurationProvider.pidsByUrl.set(urlStr, spawnedProxy.pid);
                    }
                    const url = new URL(proxyUrlString);
                    newUri = `${url.protocol.replace(`http`, `ws`)}//${url.host}{browserInspectUriPath}`;
                    eventEmmiter.emit('vsWebAssemblyReady');
                }
            });

            stream.on('error', (err) => {
                BlazorDebugConfigurationProvider.vsWebAssemblyBridgeOutputChannel.appendLine(err.toString());
                eventEmmiter.emit('vsWebAssemblyReady');
            });
        }

        handleData(spawnedProxy.stdout);
        handleData(spawnedProxy.stderr);
        await new Promise((resolve) => eventEmmiter.once('vsWebAssemblyReady', resolve));
        return [newUri, proxyICorDebugPort, proxyBrowserPort];
    }

    /**
     * Determines if the project targets .NET 9 or newer using the C# Dev Kit
     * IDebugTargetFrameworkService. Falls back to csproj parsing if the service
     * is unavailable.
     */
    private static async isNet9OrNewer(projectPath: string): Promise<boolean> {
        const devKitResult = await BlazorDebugConfigurationProvider.isNet9OrNewerViaDevKit(projectPath);
        if (devKitResult !== undefined) {
            return devKitResult;
        }
        return BlazorDebugConfigurationProvider.isNet9OrNewerViaCsproj(projectPath);
    }

    private static async isNet9OrNewerViaDevKit(projectPath: string): Promise<boolean | undefined> {
        const devKit = getCSharpDevKit();
        if (!devKit) {
            return undefined;
        }
        const proxy = await devKit.exports.serviceBroker.getProxy<IDebugTargetFrameworkService>(
            targetFrameworkServiceDescriptor
        );
        if (!proxy) {
            return undefined;
        }
        try {
            const tfmPattern = /^net(\d+)\.\d+/;
            const infos = await new Promise<ProjectDebugTargetFrameworkInfo[]>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
                const observer = new Observer<ProjectDebugTargetFrameworkInfo[]>((value) => {
                    clearTimeout(timeout);
                    resolve(value);
                });
                proxy.subscribe(observer).catch((e) => {
                    clearTimeout(timeout);
                    reject(e);
                });
            });
            const normalizePath = (p: string) => p.replace(/[\\/]+/g, '/').toLowerCase();
            for (const info of infos) {
                if (projectPath !== '' && normalizePath(info.fullPath) !== normalizePath(projectPath)) {
                    continue;
                }
                // Check debugTargetFramework
                if (info.debugTargetFramework) {
                    const match = info.debugTargetFramework.match(tfmPattern);
                    if (match && parseInt(match[1]) >= 9) {
                        return true;
                    }
                }
                // Check all available target frameworks
                for (const fw of info.availableTargetFrameworks ?? []) {
                    const match = fw.framework.match(tfmPattern);
                    if (match && parseInt(match[1]) >= 9) {
                        return true;
                    }
                }
            }
            return false;
        } catch {
            return undefined;
        } finally {
            proxy?.dispose();
        }
    }

    private static async isNet9OrNewerViaCsproj(projectPath: string): Promise<boolean> {
        const tfmPattern = /^net(\d+)\.\d+/;
        const csprojFiles = await BlazorDebugConfigurationProvider.findCsprojFiles(projectPath);
        for (const csproj of csprojFiles) {
            const tfms = BlazorDebugConfigurationProvider.parseTfmsFromCsproj(csproj);
            for (const tfm of tfms) {
                const match = tfm.match(tfmPattern);
                if (match && parseInt(match[1]) >= 9) {
                    return true;
                }
            }
        }
        return false;
    }

    private static async findCsprojFiles(projectPath: string): Promise<string[]> {
        if (projectPath === '') {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return [];
            }
            const results: string[] = [];
            for (const folder of workspaceFolders) {
                const folderCsprojs = await BlazorDebugConfigurationProvider.findCsprojFiles(folder.uri.fsPath);
                results.push(...folderCsprojs);
            }
            return results;
        }
        // If the path is a .csproj file itself, return it directly
        if (projectPath.endsWith('.csproj') && existsSync(projectPath)) {
            return [projectPath];
        }
        // Otherwise treat it as a directory and search for .csproj files
        try {
            const entries = await promises.readdir(projectPath);
            return entries.filter((e) => e.endsWith('.csproj')).map((e) => path.join(projectPath, e));
        } catch {
            return [];
        }
    }

    private static parseTfmsFromCsproj(csprojPath: string): string[] {
        try {
            const content = readFileSync(csprojPath, 'utf-8');
            // Match <TargetFramework>net9.0</TargetFramework>
            const singleMatch = content.match(/<TargetFramework>(.*?)<\/TargetFramework>/);
            if (singleMatch) {
                return [singleMatch[1].trim()];
            }
            // Match <TargetFrameworks>net8.0;net9.0</TargetFrameworks>
            const multiMatch = content.match(/<TargetFrameworks>(.*?)<\/TargetFrameworks>/);
            if (multiMatch) {
                return multiMatch[1].split(';').map((t) => t.trim());
            }
        } catch {
            // If we can't read the file, fall through
        }
        return [];
    }
    private static async useVSDbg(projectPath: string): Promise<boolean> {
        const wasmConfig = vscode.workspace.getConfiguration('csharp');
        const useVSDbg = wasmConfig.get<boolean>('wasm.debug.useVSDbg') == true;
        if (!useVSDbg) {
            return false;
        }
        const existWebAssemblyWebBridge = existsSync(BlazorDebugConfigurationProvider.getWebAssemblyWebBridgePath());
        let isNet9OrNewer = false;
        if (existWebAssemblyWebBridge) {
            isNet9OrNewer = await BlazorDebugConfigurationProvider.isNet9OrNewer(projectPath);
        }
        return useVSDbg && existWebAssemblyWebBridge && isNet9OrNewer;
    }

    private static getWebAssemblyWebBridgePath() {
        const vsWebAssemblyBridge = path.join(
            getExtensionPath(),
            '.vswebassemblybridge',
            'Microsoft.Diagnostics.BrowserDebugHost.dll'
        );
        return vsWebAssemblyBridge;
    }

    public static async tryToUseVSDbgForMono(urlStr: string, projectPath: string): Promise<[string, number, number]> {
        // Enable session tracking — C# Dev Kit calls this method directly
        // (bypassing resolveDebugConfiguration), so we start tracking here.
        BlazorDebugConfigurationProvider.trackedSessionIds.clear();
        BlazorDebugConfigurationProvider.trackedSessionsById.clear();
        BlazorDebugConfigurationProvider.isTrackingSessions = true;

        const useVSDbg = await BlazorDebugConfigurationProvider.useVSDbg(projectPath);

        if (useVSDbg) {
            const [inspectUri, portICorDebug, portBrowserDebug] =
                await BlazorDebugConfigurationProvider.launchVsWebAssemblyBridge(urlStr);

            return [inspectUri, portICorDebug, portBrowserDebug];
        }
        return ['', -1, -1];
    }

    public static async determineBrowserType(): Promise<string | undefined> {
        // There was no browser specified by the user, so we will do some auto-detection to find a browser,
        // favoring Edge if multiple valid options are installed.
        const edgeBrowserFinder = new EdgeBrowserFinder(process.env, promises, execa);
        const edgeInstallations = await edgeBrowserFinder.findAll();
        if (edgeInstallations.length > 0) {
            showInformationMessage(
                vscode,
                BlazorDebugConfigurationProvider.autoDetectUserNotice.replace('{0}', `'Edge'`)
            );

            return BlazorDebugConfigurationProvider.edgeBrowserType;
        }

        const chromeBrowserFinder = new ChromeBrowserFinder(process.env, promises, execa);
        const chromeInstallations = await chromeBrowserFinder.findAll();
        if (chromeInstallations.length > 0) {
            showInformationMessage(
                vscode,
                BlazorDebugConfigurationProvider.autoDetectUserNotice.replace('{0}', `'Chrome'`)
            );

            return BlazorDebugConfigurationProvider.chromeBrowserType;
        }

        showErrorMessage(
            vscode,
            vscode.l10n.t('Run and Debug: A valid browser is not installed. Please install Edge or Chrome.')
        );
        return undefined;
    }
}
