#!/bin/bash
set -x
set -e

# Patches from here https://github.com/dotnet/vscode-csharp/compare/main...muhammadsammy:free-vscode-csharp:master#diff-0ccaa77cc937eeac924d069abe67a8510757b97f326950c258d0e74a61a461d0R290

# Python regex patching script
rs="_patches/replacer.py"

# Patch src/coreclrDebug/activate.ts
sed -i "s/if (!executable) {/const pipeTransport = _session.configuration.pipeTransport;\n        if (!executable || typeof pipeTransport === 'object') {/" src/coreclrDebug/activate.ts
sed -i "s/let options: vscode.DebugAdapterExecutableOptions | undefined = undefined;/let options: vscode.DebugAdapterExecutableOptions = {};/" src/coreclrDebug/activate.ts
cat << 'EOL' > temp_replacement.sed
            let command = '';
            let args = [];
            if (typeof pipeTransport === 'object') {
                if (pipeTransport.debuggerPath) {
                    command = pipeTransport.debuggerPath;
                } else {
                    command = path.join(
                        common.getExtensionPath(),
                        '.debugger',
                        'netcoredbg',
                        'netcoredbg' + CoreClrDebugUtil.getPlatformExeExtension()
                    );
                }
                if (pipeTransport.debuggerArgs) {
                    args = pipeTransport.debuggerArgs;
                } else {
                    args.push('--interpreter=vscode', '--');
                }
                if (pipeTransport.pipeProgram) {
                    args.push(pipeTransport.pipeProgram);
                }
                if (pipeTransport.pipeArgs) {
                    args.push(pipeTransport.pipeArgs);
                }
                if (pipeTransport.pipeCwd) {
                    options.cwd = pipeTransport.pipeCwd;
                }
            } else {
                command = path.join(
                    common.getExtensionPath(),
                    '.debugger',
                    'netcoredbg',
                    'netcoredbg' + CoreClrDebugUtil.getPlatformExeExtension()
                );
                args = ['--interpreter=vscode'];
            }
            executable = new vscode.DebugAdapterExecutable(command, args, options);
EOL
sed -i "/executable = new vscode.DebugAdapterExecutable(command, \[\], options);/r temp_replacement.sed" src/coreclrDebug/activate.ts
sed -i "/executable = new vscode.DebugAdapterExecutable(command, \[\], options);/d" src/coreclrDebug/activate.ts
rm temp_replacement.sed
pattern="import { CoreClrDebugUtil, getTargetArchitecture } from './util';"
python "$rs" "src/coreclrDebug/activate.ts" "$pattern" "import { CoreClrDebugUtil } from './util';"
pattern="            const targetArchitecture = (.|\s)*?\);"
python "$rs" "src/coreclrDebug/activate.ts" "$pattern" ""
pattern="            const command = path\.join\((.|\s)*?\);"
python "$rs" "src/coreclrDebug/activate.ts" "$pattern" ""

# Patch src/lsptoolshost/roslynLanguageServer.ts
sed -i "/import TelemetryReporter from '@vscode\/extension-telemetry';/d" src/lsptoolshost/roslynLanguageServer.ts
sed -i "/private _telemetryReporter: TelemetryReporter,/d" src/lsptoolshost/roslynLanguageServer.ts
sed -i "/            reportProjectConfigurationEvent(/,/);/c\            reportProjectConfigurationEvent(params, this._platformInfo, dotnetInfo, this._solutionFile?.fsPath, true);" src/lsptoolshost/roslynLanguageServer.ts
sed -i "/return await this.startServer(/,/);/c\            return await this.startServer(platformInfo, hostExecutableResolver, context, additionalExtensionPaths);" src/lsptoolshost/roslynLanguageServer.ts
sed -i "/telemetryReporter: TelemetryReporter,/d" src/lsptoolshost/roslynLanguageServer.ts

pattern="\/\/ shouldn't this arg only be set if it's running with CSDevKit\?\s+args\.push\('--telemetryLevel', telemetryReporter\.telemetryLevel\);"
python "$rs" "src/lsptoolshost/roslynLanguageServer.ts" "$pattern" ""

sed -i "s/const server = new RoslynLanguageServer(client, platformInfo, context, telemetryReporter, languageServerEvents);/const server = new RoslynLanguageServer(client, platformInfo, context, languageServerEvents);/" src/lsptoolshost/roslynLanguageServer.ts

sed -i "/reporter: TelemetryReporter,/d" src/lsptoolshost/roslynLanguageServer.ts
sed -i "/        reporter,/d" src/lsptoolshost/roslynLanguageServer.ts



# Patch src/main.ts
sed -i "/import { TelemetryObserver } from '.\/observers\/telemetryObserver';/d" src/main.ts
sed -i "/import TelemetryReporter from '@vscode\/extension-telemetry';/d" src/main.ts
sed -i "/const aiKey = context.extension.packageJSON.contributes.debuggers\[0\].aiKey;/d" src/main.ts
sed -i "/const reporter = new TelemetryReporter(aiKey);/d" src/main.ts
sed -i "/    \/\/ ensure it gets properly disposed. Upon disposal the events will be flushed./d" src/main.ts
sed -i "/context.subscriptions.push(reporter);/d" src/main.ts
sed -i "/const telemetryObserver = new TelemetryObserver(platformInfo, () => reporter, useModernNetOption);/d" src/main.ts
sed -i "/eventStream.subscribe(telemetryObserver.post);/d" src/main.ts
sed -i "/reporter,/d" src/main.ts
sed -i "/const activationProperties: { \[key: string\]: string } = {/,/};/d" src/main.ts
sed -i "/serverKind: useOmnisharpServer ? 'OmniSharp' : 'Roslyn',/d" src/main.ts
sed -i "/reporter.sendTelemetryEvent('CSharpActivated', activationProperties);/d" src/main.ts

# Patch src/observers/telemetryObserver.ts
sed -i "/this.reporter,/d" src/observers/telemetryObserver.ts

# Patch src/packageManager/downloadAndInstallPackages.ts
sed -i "/import { DownloadFile } from '.\/fileDownloader';/a import { InstallTarGz } from '.\/tarGzInstaller';" src/packageManager/downloadAndInstallPackages.ts
cat << 'EOL' > temp_replacement.sed
                    if (pkg.url.includes('.tar.gz')) {
                        await InstallTarGz(buffer, pkg.description, pkg.installPath, eventStream);
                    } else {
                        await InstallZip(buffer, pkg.description, pkg.installPath, pkg.binaries, eventStream);
                    }
EOL
# Replace and delete wasnt working so delete the original line after replace
sed -i "/await InstallZip(buffer, pkg.description, pkg.installPath, pkg.binaries, eventStream);/r temp_replacement.sed" src/packageManager/downloadAndInstallPackages.ts
sed -i '0,/await InstallZip(buffer, pkg.description, pkg.installPath, pkg.binaries, eventStream);/{//d;}' src/packageManager/downloadAndInstallPackages.ts
rm temp_replacement.sed

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
sed -i "1i import * as path from 'path';" src/razor/src/extension.ts
# sed -i "s/import { RazorLanguageServerOptions } from '.\/razorLanguageServerOptions';/import type { RazorLanguageServerOptions } from '.\/razorLanguageServerOptions';/" src/razor/src/extension.ts
# sed -i "s/import { HostEventStream } from '.\/hostEventStream';/import type { HostEventStream } from '.\/hostEventStream';/" src/razor/src/extension.ts
sed -i "/    vscodeTelemetryReporter: TelemetryReporter,/d" src/razor/src/extension.ts
python "$rs" "src/razor/src/extension.ts" "import TelemetryReporter from '@vscode/extension-telemetry';\n" "$replacement"
python "$rs" "src/razor/src/extension.ts" "import { getComponentPaths } from '../../lsptoolshost/builtInComponents';\n" "$replacement"

cat << 'EOL' > temp_replacement.sed
        const dotnetRuntimePath = path.dirname(dotnetInfo.path);

        // Take care to always run .NET processes on the runtime that we intend.
        // The dotnet.exe we point to should not go looking for other runtimes.
        const env: NodeJS.ProcessEnv = { ...process.env };
        env.DOTNET_ROOT = dotnetRuntimePath;
        env.DOTNET_MULTILEVEL_LOOKUP = '0';
        // Save user's DOTNET_ROOT env-var value so server can recover the user setting when needed
        env.DOTNET_ROOT_USER = process.env.DOTNET_ROOT ?? 'EMPTY';
EOL
sed -i "/const dotnetInfo = await hostExecutableResolver.getHostExecutableInfo();/r temp_replacement.sed" src/razor/src/extension.ts
rm temp_replacement.sed

sed -i "/let telemetryExtensionDllPath = '';/d" src/razor/src/extension.ts

pattern="await setupDevKitEnvironment(.|\s)*?razorComponentPaths\[0\];(.|\s)*?}(.|\s)*?}"
python "$rs" "src/razor/src/extension.ts" "$pattern" "await setupDevKitEnvironment(env, csharpDevkitExtension, logger);"

pattern="vscodeTelemetryReporter,
            telemetryExtensionDllPath,
            dotnetInfo.env,"
replacement="csharpDevkitExtension !== undefined,
            env,"
python "$rs" "src/razor/src/extension.ts" "$pattern" "$replacement"


# Patch src/razor/src/razorLanguageServerClient.ts
sed -i "/import TelemetryReporter from '@vscode\/extension-telemetry';/d" src/razor/src/razorLanguageServerClient.ts
sed -i "s/private readonly vscodeTelemetryReporter: TelemetryReporter,/private readonly isCSharpDevKitActivated: boolean,/" src/razor/src/razorLanguageServerClient.ts
sed -i "s/private readonly telemetryExtensionDllPath: string,//" src/razor/src/razorLanguageServerClient.ts
pattern="if \(options\.forceRuntimeCodeGeneration\) {(.|\s)*?args\.push\('--telemetryExtensionPath', this\.telemetryExtensionDllPath\);"
python "$rs" "src/razor/src/razorLanguageServerClient.ts" "$pattern" "if (this.isCSharpDevKitActivated) {\n                args.push('--sessionId', getSessionId());"


# Patch src/shared/projectConfiguration.ts
sed -i "s/import { ITelemetryReporter, getTelemetryProps } from '.\/telemetryReporter';/import { getTelemetryProps } from '.\/telemetryReporter';/" src/shared/projectConfiguration.ts
sed -i "/reporter: ITelemetryReporter,/d" src/shared/projectConfiguration.ts
sed -i "/reporter.sendTelemetryEvent('ProjectConfiguration', telemetryProps);/d" src/shared/projectConfiguration.ts


# Patch src/tools/OptionsSchema.json
sed -i "s/~\/vsdbg\/vsdbg/\/usr\/bin\/netcoredbg/g" src/tools/OptionsSchema.json
sed -i "s/vsdbg/netcoredbg/g" src/tools/OptionsSchema.json



echo "$FILE applied successfully."