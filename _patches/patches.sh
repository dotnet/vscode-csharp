#!/bin/sh

# Patches from here https://github.com/dotnet/vscode-csharp/compare/main...muhammadsammy:free-vscode-csharp:master#diff-0ccaa77cc937eeac924d069abe67a8510757b97f326950c258d0e74a61a461d0R290

# Patch 1: Remove specific lines from .eslintrc.js
sed -i '/"header\/header": \[ 2, "block", \[/,/\],/d' .eslintrc.js

# Remove licences
rm RuntimeLicenses/dependencies/OpenDebugAD7-License.txt
rm RuntimeLicenses/license.txt

#TODO: Patch image

# Replace extension name
EXTENSION_NAME="blipk-vscodium.csharp"
find . -type f -exec sed -i "s/ms-dotnettools.csharp/$EXTENSION_NAME/g" {} +

# Patch src/coreclrDebug/activate.ts
sed -i "s/if (!executable) {/const pipeTransport = _session.configuration.pipeTransport;\n        if (!executable || typeof pipeTransport === 'object') {/" src/coreclrDebug/activate.ts
sed -i "s/let options: vscode.DebugAdapterExecutableOptions | undefined = undefined;/let options: vscode.DebugAdapterExecutableOptions = {};/" src/coreclrDebug/activate.ts
sed -i "/executable = new vscode.DebugAdapterExecutable(command, [], options);/c\
            let command = '';\
            let args = [];\
            if (typeof pipeTransport === 'object') {\
                if (pipeTransport.debuggerPath) {\
                    command = pipeTransport.debuggerPath;\
                } else {\
                    command = path.join(\
                        common.getExtensionPath(),\
                        '.debugger',\
                        'netcoredbg',\
                        'netcoredbg' + CoreClrDebugUtil.getPlatformExeExtension()\
                    );\
                }\
                if (pipeTransport.debuggerArgs) {\
                    args = pipeTransport.debuggerArgs;\
                } else {\
                    args.push('--interpreter=vscode', '--');\
                }\
                if (pipeTransport.pipeProgram) {\
                    args.push(pipeTransport.pipeProgram);\
                }\
                if (pipeTransport.pipeArgs) {\
                    args.push(pipeTransport.pipeArgs);\
                }\
                if (pipeTransport.pipeCwd) {\
                    options.cwd = pipeTransport.pipeCwd;\
                }\
            } else {\
                command = path.join(\
                    common.getExtensionPath(),\
                    '.debugger',\
                    'netcoredbg',\
                    'netcoredbg' + CoreClrDebugUtil.getPlatformExeExtension()\
                );\
                args = ['--interpreter=vscode'];\
            }\
            executable = new vscode.DebugAdapterExecutable(command, args, options);" src/coreclrDebug/activate.ts

# Patch src/lsptoolshost/roslynLanguageServer.ts
sed -i "/import TelemetryReporter from '@vscode\/extension-telemetry';/d" src/lsptoolshost/roslynLanguageServer.ts
sed -i "/private _telemetryReporter: TelemetryReporter,/d" src/lsptoolshost/roslynLanguageServer.ts
sed -i "s/reportProjectConfigurationEvent(this._telemetryReporter, params, this._platformInfo, dotnetInfo, this._solutionFile?.fsPath, true);/reportProjectConfigurationEvent(params, this._platformInfo, dotnetInfo, this._solutionFile?.fsPath, true);/" src/lsptoolshost/roslynLanguageServer.ts
sed -i "/telemetryReporter: TelemetryReporter,/d" src/lsptoolshost/roslynLanguageServer.ts
sed -i "s/await this.startServer(platformInfo, hostExecutableResolver, context, telemetryReporter, additionalExtensionPaths);/await this.startServer(platformInfo, hostExecutableResolver, context, additionalExtensionPaths);/" src/lsptoolshost/roslynLanguageServer.ts
sed -i "s/const server = new RoslynLanguageServer(client, platformInfo, context, telemetryReporter, languageServerEvents);/const server = new RoslynLanguageServer(client, platformInfo, context, languageServerEvents);/" src/lsptoolshost/roslynLanguageServer.ts
sed -i "s/telemetryReporter: TelemetryReporter,/d" src/lsptoolshost/roslynLanguageServer.ts

# Patch src/main.ts
sed -i "/import { TelemetryObserver } from '.\/observers\/telemetryObserver';/d" src/main.ts
sed -i "/import TelemetryReporter from '@vscode\/extension-telemetry';/d" src/main.ts
sed -i "/const aiKey = context.extension.packageJSON.contributes.debuggers\[0\].aiKey;/d" src/main.ts
sed -i "/const reporter = new TelemetryReporter(aiKey);/d" src/main.ts
sed -i "/context.subscriptions.push(reporter);/d" src/main.ts
sed -i "/const telemetryObserver = new TelemetryObserver(platformInfo, () => reporter, useModernNetOption);/d" src/main.ts
sed -i "/eventStream.subscribe(telemetryObserver.post);/d" src/main.ts
sed -i "/reporter,/d" src/main.ts
sed -i "/const activationProperties: { \[key: string\]: string } = {/d" src/main.ts
sed -i "/serverKind: useOmnisharpServer ? 'OmniSharp' : 'Roslyn',/d" src/main.ts
sed -i "/reporter.sendTelemetryEvent('CSharpActivated', activationProperties);/d" src/main.ts

# Patch src/observers/telemetryObserver.ts
sed -i "/this.reporter,/d" src/observers/telemetryObserver.ts

# Patch src/packageManager/downloadAndInstallPackages.ts
sed -i "/import { InstallTarGz } from '.\/tarGzInstaller';/d" src/packageManager/downloadAndInstallPackages.ts
sed -i "/await InstallZip(buffer, pkg.description, pkg.installPath, pkg.binaries, eventStream);/c\
                    if (pkg.url.includes('.tar.gz')) {\
                        await InstallTarGz(buffer, pkg.description, pkg.installPath, eventStream);\
                    } else {\
                        await InstallZip(buffer, pkg.description, pkg.installPath, pkg.binaries, eventStream);\
                    }" src/packageManager/downloadAndInstallPackages.ts

# Add src/packageManager/tarGzInstaller.ts
cat <<EOL > src/packageManager/tarGzInstaller.ts
/*---------------------------------------------------------------------------------------------
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as tar from 'tar';
import { Readable } from 'stream';
import { EventStream } from '../eventStream';
import { InstallationStart, ZipError } from '../omnisharp/loggingEvents';
import { NestedError } from '../nestedError';
import { AbsolutePath } from './absolutePath';

export async function InstallTarGz(
    buffer: Buffer,
    description: string,
    destinationInstallPath: AbsolutePath,
    eventStream: EventStream
): Promise<void> {
    eventStream.post(new InstallationStart(description));

    return new Promise<void>((resolve, reject) => {
        const reader = new Readable();
        reader.push(buffer);
        reader.push(null);
        reader
            .pipe(
                tar.extract({
                    cwd: destinationInstallPath.value,
                })
            )
            .on('error', (err) => {
                const message = 'Error extracting tar file. ' + err.message;
                eventStream.post(new ZipError(message));
                return reject(new NestedError(message));
            })
            .on('end', () => resolve());
    });
}
EOL

# Patch src/razor/razor.ts
sed -i "/import TelemetryReporter from '@vscode\/extension-telemetry';/d" src/razor/razor.ts
sed -i "/vscodeTelemetryReporter: TelemetryReporter,/d" src/razor/razor.ts
sed -i "/vscodeTelemetryReporter,/d" src/razor/razor.ts

# Patch src/razor/src/extension.ts
sed -i "/import * as vscodeapi from 'vscode';/d" src/razor/src/extension.ts
sed -i "/import { ExtensionContext } from 'vscode';/d" src/razor/src/extension.ts
sed -i "1i import * as path from 'path';" src/razor/src/extension.ts
sed -i "s/import { CSharpDevKitExports } from '..\/..\/csharpDevKitExports';/import type { CSharpDevKitExports } from '..\/..\/csharpDevKitExports';/" src/razor/src/extension.ts
sed -i "s/import { PlatformInformation } from '..\/..\/shared\/platform';/import type { PlatformInformation } from '..\/..\/shared\/platform';/" src/razor/src/extension.ts
sed -i "s/import { IEventEmitterFactory } from '.\/IEventEmitterFactory';/import type { IEventEmitterFactory } from '.\/IEventEmitterFactory';/" src/razor/src/extension.ts
sed -i "s/import { RazorLanguageServerOptions } from '.\/razorLanguageServerOptions';/import type { RazorLanguageServerOptions } from '.\/razorLanguageServerOptions';/" src/razor/src/extension.ts
sed -i "s/import { HostEventStream } from '.\/hostEventStream';/import type { HostEventStream } from '.\/hostEventStream';/" src/razor/src/extension.ts

# Patch src/razor/src/razorLanguageServerClient.ts
sed -i "/import TelemetryReporter from '@vscode\/extension-telemetry';/d" src/razor/src/razorLanguageServerClient.ts
sed -i "s/private readonly vscodeTelemetryReporter: TelemetryReporter,/private readonly isCSharpDevKitActivated: boolean,/" src/razor/src/razorLanguageServerClient.ts
sed -i "s/private readonly telemetryExtensionDllPath: string,//" src/razor/src/razorLanguageServerClient.ts
sed -i "/if (options.forceRuntimeCodeGeneration) {/d" src/razor/src/razorLanguageServerClient.ts
sed -i "/args.push('--ForceRuntimeCodeGeneration');/d" src/razor/src/razorLanguageServerClient.ts
sed -i "/args.push('true');/d" src/razor/src/razorLanguageServerClient.ts
sed -i "/if (this.telemetryExtensionDllPath.length > 0) {/d" src/razor/src/razorLanguageServerClient.ts
sed -i "/args.push('--telemetryLevel', this.vscodeTelemetryReporter.telemetryLevel);/d" src/razor/src/razorLanguageServerClient.ts
sed -i "/args.push('--telemetryExtensionPath', this.telemetryExtensionDllPath);/d" src/razor/src/razorLanguageServerClient.ts

# Patch src/shared/projectConfiguration.ts
sed -i "/import { ITelemetryReporter, getTelemetryProps } from '.\/telemetryReporter';/d" src/shared/projectConfiguration.ts
sed -i "1i import { getTelemetryProps } from '.\/telemetryReporter';" src/shared/projectConfiguration.ts
sed -i "/reporter: ITelemetryReporter,/d" src/shared/projectConfiguration.ts
sed -i "/reporter.sendTelemetryEvent('ProjectConfiguration', telemetryProps);/d" src/shared/projectConfiguration.ts

# Patch src/tools/OptionsSchema.json
sed -i "s/vsdbg/netcoredbg/g" src/tools/OptionsSchema.json

# Patch tasks/backcompatTasks.ts
sed -i "1i gulp.task('package:neutral', gulp.series('vsix:release:neutral'));" tasks/backcompatTasks.ts

# Patch tasks/offlinePackagingTasks.ts
sed -i "1i gulp.task('vsix:release:neutral', async () => {\
    await cleanAsync();\
    await doPackageNeutral();\
});\
\
async function doPackageNeutral() {\
    let prerelease = false;\
    if (argv.prerelease) {\
        prerelease = true;\
    }\
    try {\
        const packageJSON = getPackageJSON();\
        await buildVsix(packageJSON, packedVsixOutputRoot, prerelease);\
    } catch (err) {\
        console.log(err);\
    }\
}" tasks/offlinePackagingTasks.ts

echo "All patches applied successfully."