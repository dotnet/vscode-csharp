/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * See LICENSE.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as child_process from 'child_process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { PlatformInformation } from '../platform';
import { getExtensionPath } from '../common';

export interface AttachItem extends vscode.QuickPickItem {
    id: string;
    flags: number;
}

export interface AttachItemsProvider {
    getAttachItems(): Promise<AttachItem[]>;
}

export class AttachPicker {
    constructor(private attachItemsProvider: AttachItemsProvider) { }

    public async ShowAttachEntries(): Promise<AttachItem> {
        return this.attachItemsProvider.getAttachItems()
            .then(processEntries => {
                let attachPickOptions: vscode.QuickPickOptions = {
                    ignoreFocusOut: true,
                    matchOnDescription: true,
                    matchOnDetail: true,
                    placeHolder: "Select the process to attach to"
                };

                return vscode.window.showQuickPick(processEntries, attachPickOptions)
                    .then(chosenProcess => {
                        return chosenProcess;
                    });
            });
    }
}

interface IPipeTransportOptions {
    pipeProgram: string;
    pipeArgs: string | string[];
    pipeCwd: string;
    quoteArgs: boolean;
}

export class RemoteAttachPicker {
    public static get commColumnTitle() { return Array(PsOutputParser.secondColumnCharacters).join("a"); }
    public static get linuxPsCommand() { return `ps axww -o pid=,flags=,comm=${RemoteAttachPicker.commColumnTitle},args=`; }
    public static get osxPsCommand() { return `ps axww -o pid=,flags=,comm=${RemoteAttachPicker.commColumnTitle},args= -c`; }
    public static get debuggerCommand() { return "${debuggerCommand}"; }
    public static get scriptShellCmd() { return "sh -s"; }


    private static _channel: vscode.OutputChannel = null;

    public static async ValidateAndFixPipeProgram(program: string): Promise<string> {
        return PlatformInformation.GetCurrent().then(platformInfo => {
            // Check if we are on a 64 bit Windows
            if (platformInfo.isWindows() && platformInfo.architecture === "x86_64") {
                let sysRoot: string = process.env.SystemRoot;
                let oldPath = path.join(sysRoot, 'System32');
                let newPath = path.join(sysRoot, 'sysnative');

                // Escape backslashes, replace and ignore casing
                let regex = RegExp(oldPath.replace(/\\/g, '\\\\'), "ig");

                // Replace System32 with sysnative
                let newProgram = program.replace(regex, newPath);

                // Check if program strong contains System32 directory.
                // And if the program does not exist in System32, but it does in sysnative.
                // Return sysnative program
                if (program.toLowerCase().startsWith(oldPath.toLowerCase()) &&
                    !fs.existsSync(program) && fs.existsSync(newProgram)) {

                    return newProgram;
                }
            }

            // Return original program and let it fall through
            return program;
        });
    }

    // Note: osPlatform is passed as an argument for testing.
    public static getPipeTransportOptions(pipeTransport: any, osPlatform: string): IPipeTransportOptions {
        let pipeProgram: string = pipeTransport.pipeProgram;
        let pipeArgs: string[] | string = pipeTransport.pipeArgs;
        let pipeCwd: string = pipeTransport.pipeCwd;
        let quoteArgs: boolean = pipeTransport.quoteArgs != null ? pipeTransport.quoteArgs : true; // default value is true
        let platformSpecificPipeTransportOptions: IPipeTransportOptions = this.getPlatformSpecificPipeTransportOptions(pipeTransport, osPlatform);

        if (platformSpecificPipeTransportOptions) {
            pipeProgram = platformSpecificPipeTransportOptions.pipeProgram || pipeProgram;
            pipeArgs = platformSpecificPipeTransportOptions.pipeArgs || pipeArgs;
            pipeCwd = platformSpecificPipeTransportOptions.pipeCwd || pipeCwd;
            quoteArgs = platformSpecificPipeTransportOptions.quoteArgs != null ? platformSpecificPipeTransportOptions.quoteArgs : quoteArgs;
        }

        return {
            pipeProgram: pipeProgram,
            pipeArgs: pipeArgs,
            pipeCwd: pipeCwd,
            quoteArgs: quoteArgs
        };
    }

    // If the current process is on a current operating system and a specific pipe transport
    // is included, then use that specific pipe transport configuration.
    //
    // Note: osPlatform is passed as an argument for testing.
    private static getPlatformSpecificPipeTransportOptions(config: any, osPlatform: string): IPipeTransportOptions {
        if (osPlatform === "darwin" && config.osx) {
            return config.osx;
        } else if (osPlatform === "linux" && config.linux) {
            return config.linux;
        } else if (osPlatform === "win32" && config.windows) {
            return config.windows;
        }

        return null;
    }

    // Creates a pipe command string based on the type of pipe args.
    private static async createPipeCmd(pipeProgram: string, pipeArgs: string | string[], quoteArgs: boolean): Promise<string> {
        return this.ValidateAndFixPipeProgram(pipeProgram).then(async fixedPipeProgram => {
            if (typeof pipeArgs === "string") {
                return Promise.resolve(this.createPipeCmdFromString(fixedPipeProgram, pipeArgs, quoteArgs));
            }
            else if (pipeArgs instanceof Array) {
                return Promise.resolve(this.createPipeCmdFromArray(fixedPipeProgram, pipeArgs, quoteArgs));
            } else {
                // Invalid args type
                return Promise.reject<string>(new Error("pipeArgs must be a string or a string array type"));
            }
        });
    }

    public static createPipeCmdFromString(pipeProgram: string, pipeArgs: string, quoteArgs: boolean): string {
        // Quote program if quoteArgs is true.
        let pipeCmd: string = this.quoteArg(pipeProgram);

        // If ${debuggerCommand} exists in pipeArgs, replace. No quoting is applied to the command here.
        if (pipeArgs.indexOf(this.debuggerCommand) >= 0) {
            pipeCmd = pipeCmd.concat(" ", pipeArgs.replace(/\$\{debuggerCommand\}/g, this.scriptShellCmd));
        }
        // Add ${debuggerCommand} to the end of the args. Quote if quoteArgs is true.
        else {
            pipeCmd = pipeCmd.concat(" ", pipeArgs.concat(" ", this.quoteArg(this.scriptShellCmd, quoteArgs)));
        }

        return pipeCmd;
    }

    public static createPipeCmdFromArray(pipeProgram: string, pipeArgs: string[], quoteArgs: boolean): string {
        let pipeCmdList: string[] = [];
        // Add pipeProgram to the start. Quoting is handeled later.
        pipeCmdList.push(pipeProgram);

        // If ${debuggerCommand} exists, replace it.
        if (pipeArgs.filter(arg => arg.indexOf(this.debuggerCommand) >= 0).length > 0) {
            for (let arg of pipeArgs) {
                while (arg.indexOf(this.debuggerCommand) >= 0) {
                    arg = arg.replace(this.debuggerCommand, RemoteAttachPicker.scriptShellCmd);
                }

                pipeCmdList.push(arg);
            }
        }
        // Add ${debuggerCommand} to the end of the arguments.
        else {
            pipeCmdList = pipeCmdList.concat(pipeArgs);
            pipeCmdList.push(this.scriptShellCmd);
        }

        // Quote if enabled.
        return quoteArgs ? this.createArgumentList(pipeCmdList) : pipeCmdList.join(' ');
    }

    // Quote the arg if the flag is enabled and there is a space.
    public static quoteArg(arg: string, quoteArg: boolean = true): string {
        if (quoteArg && arg.includes(' ')) {
            return `"${arg}"`;
        }

        return arg;
    }

    // Converts an array of string arguments to a string version. Always quotes any arguments with spaces.
    public static createArgumentList(args: string[]): string {
        return args.map(arg => this.quoteArg(arg)).join(" ");
    }

    public static async ShowAttachEntries(args: any, platformInfo: PlatformInformation): Promise<AttachItem> {
        // Create remote attach output channel for errors.
        if (!RemoteAttachPicker._channel) {
            RemoteAttachPicker._channel = vscode.window.createOutputChannel('remote-attach');
        } else {
            RemoteAttachPicker._channel.clear();
        }

        // Grab selected name from UI
        // Args may be null if ran with F1
        let name: string = args ? args.name : null;

        if (!name) {
            // Config name not found.
            return Promise.reject<AttachItem>(new Error("Name not defined in current configuration."));
        }

        if (!args.pipeTransport || !args.pipeTransport.debuggerPath) {
            // Missing PipeTransport and debuggerPath, prompt if user wanted to just do local attach.
            return Promise.reject<AttachItem>(new Error("Configuration \"" + name + "\" in launch.json does not have a " +
                "pipeTransport argument with debuggerPath for remote process listing."));
        } else {
            let pipeTransport = this.getPipeTransportOptions(args.pipeTransport, os.platform());

            return RemoteAttachPicker.createPipeCmd(pipeTransport.pipeProgram, pipeTransport.pipeArgs, pipeTransport.quoteArgs)
                .then(async pipeCmd => RemoteAttachPicker.getRemoteOSAndProcesses(pipeCmd, pipeTransport.pipeCwd, platformInfo))
                .then(processes => {
                    let attachPickOptions: vscode.QuickPickOptions = {
                        ignoreFocusOut: true,
                        matchOnDescription: true,
                        matchOnDetail: true,
                        placeHolder: "Select the process to attach to"
                    };
                    return vscode.window.showQuickPick(processes, attachPickOptions);
                });
        }
    }

    public static async getRemoteOSAndProcesses(pipeCmd: string, pipeCwd: string, platformInfo: PlatformInformation): Promise<AttachItem[]> {
        const scriptPath = path.join(getExtensionPath(), 'scripts', 'remoteProcessPickerScript');

        return execChildProcessAndOutputErrorToChannel(`${pipeCmd} < "${scriptPath}"`, pipeCwd, RemoteAttachPicker._channel, platformInfo).then(output => {
            // OS will be on first line
            // Processess will follow if listed
            let lines = output.split(/\r?\n/);

            if (lines.length == 0) {
                return Promise.reject<AttachItem[]>(new Error("Pipe transport failed to get OS and processes."));
            }
            else {
                let remoteOS = lines[0].replace(/[\r\n]+/g, '');

                if (remoteOS != "Linux" && remoteOS != "Darwin") {
                    return Promise.reject<AttachItem[]>(new Error(`Operating system "${remoteOS}"" not supported.`));
                }

                // Only got OS from uname
                if (lines.length == 1) {
                    return Promise.reject<AttachItem[]>(new Error("Transport attach could not obtain processes list."));
                } else {
                    let processes = lines.slice(1);
                    return sortProcessEntries(PsOutputParser.parseProcessFromPsArray(processes), remoteOS);
                }
            }
        });
    }
}

class Process {
    constructor(public name: string, public pid: string, public commandLine: string, public flags: number) { }

    public toAttachItem(): AttachItem {
        return {
            label: this.name,
            description: this.pid,
            detail: this.commandLine,
            id: this.pid,
            flags: this.flags
        };
    }
}

export class DotNetAttachItemsProviderFactory {
    static Get(): AttachItemsProvider {
        if (os.platform() === 'win32') {
            return new WmicAttachItemsProvider();
        }
        else {
            return new PsAttachItemsProvider();
        }
    }
}

abstract class DotNetAttachItemsProvider implements AttachItemsProvider {
    protected abstract getInternalProcessEntries(): Promise<Process[]>;

    async getAttachItems(): Promise<AttachItem[]> {
        return this.getInternalProcessEntries().then(processEntries => {
            return sortProcessEntries(processEntries, os.platform());
        });
    }
}

function sortProcessEntries(processEntries: Process[], osPlatform: string): AttachItem[] {
    // localeCompare is significantly slower than < and > (2000 ms vs 80 ms for 10,000 elements)
    // We can change to localeCompare if this becomes an issue
    let dotnetProcessName = (osPlatform === 'win32') ? 'dotnet.exe' : 'dotnet';
    processEntries = processEntries.sort((a, b) => {
        if (a.name.toLowerCase() === dotnetProcessName && b.name.toLowerCase() === dotnetProcessName) {
            return a.commandLine.toLowerCase() < b.commandLine.toLowerCase() ? -1 : 1;
        } else if (a.name.toLowerCase() === dotnetProcessName) {
            return -1;
        } else if (b.name.toLowerCase() === dotnetProcessName) {
            return 1;
        } else {
            return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
        }
    });

    let attachItems = processEntries.map(p => p.toAttachItem());
    return attachItems;
}

export class PsAttachItemsProvider extends DotNetAttachItemsProvider {
    protected async getInternalProcessEntries(): Promise<Process[]> {
        // the BSD version of ps uses '-c' to have 'comm' only output the executable name and not
        // the full path. The Linux version of ps has 'comm' to only display the name of the executable
        // Note that comm on Linux systems is truncated to 16 characters:
        // https://bugzilla.redhat.com/show_bug.cgi?id=429565
        // Since 'args' contains the full path to the executable, even if truncated, searching will work as desired.
        const psCommand = os.platform() === 'darwin' ? RemoteAttachPicker.osxPsCommand : RemoteAttachPicker.linuxPsCommand;
        return execChildProcess(psCommand, null).then(processes => {
            return PsOutputParser.parseProcessFromPs(processes);
        });
    }
}

export class PsOutputParser {
    // Perf numbers:
    // OS X 10.10
    // | # of processes | Time (ms) |
    // |----------------+-----------|
    // |            272 |        52 |
    // |            296 |        49 |
    // |            384 |        53 |
    // |            784 |       116 |
    //
    // Ubuntu 16.04
    // | # of processes | Time (ms) |
    // |----------------+-----------|
    // |            232 |        26 |
    // |            336 |        34 |
    // |            736 |        62 |
    // |           1039 |       115 |
    // |           1239 |       182 |

    // ps outputs as a table. With the option "ww", ps will use as much width as necessary.
    // However, that only applies to the right-most column. Here we use a hack of setting
    // the column header to 50 a's so that the second column will have at least that many
    // characters. 50 was chosen because that's the maximum length of a "label" in the
    // QuickPick UI in VSCode.
    public static get secondColumnCharacters() { return 50; }

    // Only public for tests.
    public static parseProcessFromPs(processes: string): Process[] {
        let lines = processes.split(os.EOL);
        let processEntries: Process[] = [];

        // lines[0] is the header of the table
        for (let i = 1; i < lines.length; i++) {
            let line = lines[i];
            if (!line) {
                continue;
            }

            let process = this.parseLineFromPs(line);
            if (process) {
                processEntries.push(process);
            }
        }

        return processEntries;
    }

    public static parseProcessFromPsArray(lines: string[]): Process[] {
        let processEntries: Process[] = [];

        // lines[0] is the header of the table
        for (let i = 1; i < lines.length; i++) {
            let line = lines[i];
            if (!line) {
                continue;
            }

            let process = this.parseLineFromPs(line);
            if (process) {
                processEntries.push(process);
            }
        }

        return processEntries;
    }

    private static parseLineFromPs(line: string): Process {
        // Explanation of the regex:
        //   - any leading whitespace
        //   - PID
        //   - whitespace
        //   - flags (hex value)
        //   - whitespace
        //   - executable name --> this is PsAttachItemsProvider.secondColumnCharacters - 1 because ps reserves one character
        //     for the whitespace separator
        //   - whitespace
        //   - args (might be empty)
        const psEntry = new RegExp(`^\\s*([0-9]+)\\s+([0-9a-fA-F]+)\\s+(.{${PsOutputParser.secondColumnCharacters - 1}})\\s+(.*)$`);
        const matches = psEntry.exec(line);
        if (matches && matches.length === 5) {
            const pid = matches[1].trim();
            const flags = parseInt(matches[2].trim(), 16); // flags comes in as hex
            const executable = matches[3].trim();
            const cmdline = matches[4].trim();
            return new Process(executable, pid, cmdline, flags);
        }
    }
}

export class WmicAttachItemsProvider extends DotNetAttachItemsProvider {
    protected async getInternalProcessEntries(): Promise<Process[]> {
        const wmicCommand = 'wmic process get Name,ProcessId,CommandLine /FORMAT:list';
        return execChildProcess(wmicCommand, null).then(processes => {
            return WmicOutputParser.parseProcessFromWmic(processes);
        });
    }
}

export class WmicOutputParser {
    // Perf numbers on Win10:
    // | # of processes | Time (ms) |
    // |----------------+-----------|
    // |            309 |       413 |
    // |            407 |       463 |
    // |            887 |       746 |
    // |           1308 |      1132 |

    private static get wmicNameTitle() { return 'Name'; }
    private static get wmicCommandLineTitle() { return 'CommandLine'; }
    private static get wmicPidTitle() { return 'ProcessId'; }

    // Only public for tests.
    public static parseProcessFromWmic(processes: string): Process[] {
        let lines = processes.split(os.EOL);
        let currentProcess: Process = new Process(null, null, null, null);
        let processEntries: Process[] = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (!line) {
                continue;
            }

            this.parseLineFromWmic(line, currentProcess);

            // Each entry of processes has ProcessId as the last line
            if (line.startsWith(WmicOutputParser.wmicPidTitle)) {
                processEntries.push(currentProcess);
                currentProcess = new Process(null, null, null, null);
            }
        }

        return processEntries;
    }

    private static parseLineFromWmic(line: string, process: Process) {
        let splitter = line.indexOf('=');
        if (splitter >= 0) {
            let key = line.slice(0, line.indexOf('='));
            let value = line.slice(line.indexOf('=') + 1);
            if (key === WmicOutputParser.wmicNameTitle) {
                process.name = value.trim();
            }
            else if (key === WmicOutputParser.wmicPidTitle) {
                process.pid = value.trim();
            }
            else if (key === WmicOutputParser.wmicCommandLineTitle) {
                const extendedLengthPath = '\\??\\';
                if (value.startsWith(extendedLengthPath)) {
                    value = value.slice(extendedLengthPath.length).trim();
                }

                process.commandLine = value.trim();
            }
        }
    }

}

async function execChildProcess(process: string, workingDirectory: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        child_process.exec(process, { cwd: workingDirectory, maxBuffer: 500 * 1024 }, (error: Error, stdout: string, stderr: string) => {
            if (error) {
                reject(error);
                return;
            }

            if (stderr && !stderr.includes("screen size is bogus")) {
                reject(new Error(stderr));
                return;
            }

            resolve(stdout);
        });
    });
}

// VSCode cannot find the path "c:\windows\system32\bash.exe" as bash.exe is only available on 64bit OS.
// It can be invoked from "c:\windows\sysnative\bash.exe", so adding "c:\windows\sysnative" to path if we identify
// VSCode is running in windows and doesn't have it in the path.
async function GetSysNativePathIfNeeded(platformInfo: PlatformInformation): Promise<NodeJS.ProcessEnv> {
    let env = process.env;
    if (platformInfo.isWindows() && platformInfo.architecture === "x86_64") {
        let sysnative: String = process.env.WINDIR + "\\sysnative";
        env.Path = process.env.PATH + ";" + sysnative;
    }

    return env;
}

async function execChildProcessAndOutputErrorToChannel(process: string, workingDirectory: string, channel: vscode.OutputChannel, platformInfo: PlatformInformation): Promise<string> {
    channel.appendLine(`Executing: ${process}`);

    return new Promise<string>(async (resolve, reject) => {
        return GetSysNativePathIfNeeded(platformInfo).then(newEnv => {
            child_process.exec(process, { cwd: workingDirectory, env: newEnv, maxBuffer: 500 * 1024 }, (error: Error, stdout: string, stderr: string) => {
                let channelOutput = "";

                if (stdout && stdout.length > 0) {
                    channelOutput = channelOutput.concat(stdout);
                }

                if (stderr && stderr.length > 0) {
                    channelOutput = channelOutput.concat("stderr: " + stderr);
                }

                if (error) {
                    channelOutput = channelOutput.concat("Error Message: " + error.message);
                }


                if (error || (stderr && stderr.length > 0)) {
                    channel.append(channelOutput);
                    channel.show();
                    reject(new Error("See remote-attach output"));
                    return;
                }

                resolve(stdout);
            });
        });
    });

}
