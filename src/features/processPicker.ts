/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * See LICENSE.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as os from 'os';
import * as vscode from 'vscode';
import * as child_process from 'child_process';

export interface AttachItem extends vscode.QuickPickItem {
    id: string;
}

export interface AttachItemsProvider {
    getAttachItems(): Promise<AttachItem[]>;
}

export class AttachPicker {
    constructor(private attachItemsProvider: AttachItemsProvider) { }

    public ShowAttachEntries(): Promise<string> {
        return this.attachItemsProvider.getAttachItems()
            .then(processEntries => {
                let attachPickOptions: vscode.QuickPickOptions = {
                    matchOnDescription: true,
                    matchOnDetail: true,
                    placeHolder: "Select the process to attach to"                    
                };

                return vscode.window.showQuickPick(processEntries, attachPickOptions)
                    .then(chosenProcess => {
                        return chosenProcess ? chosenProcess.id : null;
                    });
            });
    }
}

class Process {
    constructor(public name: string, public pid: string, public commandLine: string) { }

    public toAttachItem(): AttachItem {
        return {
            label: this.name,
            description: this.pid,
            detail: this.commandLine,
            id: this.pid
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

    getAttachItems(): Promise<AttachItem[]> {
        return this.getInternalProcessEntries().then(processEntries => {
            // localeCompare is significantly slower than < and > (2000 ms vs 80 ms for 10,000 elements)
            // We can change to localeCompare if this becomes an issue
            let dotnetProcessName = (os.platform() === 'win32') ? 'dotnet.exe' : 'dotnet';
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
        });
    }
}

export class PsAttachItemsProvider extends DotNetAttachItemsProvider {
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
    private static get secondColumnCharacters() { return 50; }

    protected getInternalProcessEntries(): Promise<Process[]> {
        const commColumnTitle = Array(PsAttachItemsProvider.secondColumnCharacters).join("a");
        // the BSD version of ps uses '-c' to have 'comm' only output the executable name and not
        // the full path. The Linux version of ps has 'comm' to only display the name of the executable
        // Note that comm on Linux systems is truncated to 16 characters:
        // https://bugzilla.redhat.com/show_bug.cgi?id=429565
        // Since 'args' contains the full path to the executable, even if truncated, searching will work as desired.
        const psCommand = `ps -axww -o pid=,comm=${commColumnTitle},args=` + (os.platform() === 'darwin' ? ' -c' : '');
        return execChildProcess(psCommand, null).then(processes => {
            return this.parseProcessFromPs(processes);
        });
    }

    // Only public for tests.
    public parseProcessFromPs(processes: string): Process[] {
        let lines = processes.split(os.EOL);
        let processEntries: Process[] = [];

        // lines[0] is the header of the table
        for (let i = 1; i < lines.length; i++) {
            let line = lines[i];
            if (!line) {
                continue;
            }

            let process = this.parseLineFromPs(line);
            processEntries.push(process);
        }

        return processEntries;
    }

    private parseLineFromPs(line: string): Process {
        // Explanation of the regex:
        //   - any leading whitespace
        //   - PID
        //   - whitespace
        //   - executable name --> this is PsAttachItemsProvider.secondColumnCharacters - 1 because ps reserves one character
        //     for the whitespace separator
        //   - whitespace
        //   - args (might be empty)
        const psEntry = new RegExp(`^\\s*([0-9]+)\\s+(.{${PsAttachItemsProvider.secondColumnCharacters - 1}})\\s+(.*)$`);
        const matches = psEntry.exec(line);
        if (matches && matches.length === 4) {
            const pid = matches[1].trim();
            const executable = matches[2].trim();
            const cmdline = matches[3].trim();
            return new Process(executable, pid, cmdline);
        }
    }
}

export class WmicAttachItemsProvider extends DotNetAttachItemsProvider {
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

    protected getInternalProcessEntries(): Promise<Process[]> {
        const wmicCommand = 'wmic process get Name,ProcessId,CommandLine /FORMAT:list';
        return execChildProcess(wmicCommand, null).then(processes => {
            return this.parseProcessFromWmic(processes);
        });
    }

    // Only public for tests.
    public parseProcessFromWmic(processes: string): Process[] {
        let lines = processes.split(os.EOL);
        let currentProcess: Process = new Process(null, null, null);
        let processEntries: Process[] = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (!line) {
                continue;
            }

            this.parseLineFromWmic(line, currentProcess);

            // Each entry of processes has ProcessId as the last line
            if (line.startsWith(WmicAttachItemsProvider.wmicPidTitle)) {
                processEntries.push(currentProcess);
                currentProcess = new Process(null, null, null);
            }
        }

        return processEntries;
    }

    private parseLineFromWmic(line: string, process: Process) {
        let splitter = line.indexOf('=');
        if (splitter >= 0) {
            let key = line.slice(0, line.indexOf('='));
            let value = line.slice(line.indexOf('=') + 1);
            if (key === WmicAttachItemsProvider.wmicNameTitle) {
                process.name = value.trim();
            }
            else if (key === WmicAttachItemsProvider.wmicPidTitle) {
                process.pid = value.trim();
            }
            else if (key === WmicAttachItemsProvider.wmicCommandLineTitle) {
                const extendedLengthPath = '\\??\\';
                if (value.startsWith(extendedLengthPath)) {
                    value = value.slice(extendedLengthPath.length).trim();
                }

                process.commandLine = value.trim();
            }
        }
    }
}

function execChildProcess(process: string, workingDirectory: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        child_process.exec(process, { cwd: workingDirectory, maxBuffer: 500 * 1024 }, (error: Error, stdout: string, stderr: string) => {
            if (error) {
                reject(error);
                return;
            }

            if (stderr && stderr.length > 0) {
                reject(new Error(stderr));
                return;
            }

            resolve(stdout);
        });
    });
}