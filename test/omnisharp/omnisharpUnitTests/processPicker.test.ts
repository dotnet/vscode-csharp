/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect } from '@jest/globals';
import { RemoteAttachPicker, Process, CimProcessParser } from '../../../src/shared/processPicker';

describe('Remote Process Picker: Validate quoting arguments.', () => {
    test('Argument with no spaces', () => {
        const nonQuotedArg = RemoteAttachPicker.quoteArg('C:\\Users\\nospace\\program.exe');

        expect(nonQuotedArg).toStrictEqual('C:\\Users\\nospace\\program.exe');
    });

    test('Argument with spaces', () => {
        const nonQuotedArg = RemoteAttachPicker.quoteArg('C:\\Users\\s p a c e\\program.exe');

        expect(nonQuotedArg).toStrictEqual('"C:\\Users\\s p a c e\\program.exe"');
    });

    test('Argument with spaces with no quotes', () => {
        const nonQuotedArg = RemoteAttachPicker.quoteArg('C:\\Users\\s p a c e\\program.exe', false);

        expect(nonQuotedArg).toStrictEqual('C:\\Users\\s p a c e\\program.exe');
    });

    test('WSL with array arguments and quote args', () => {
        const pipeTransport = GetWindowsWSLLaunchJSONWithArrayArgs();

        const pipeCmd = RemoteAttachPicker.createPipeCmdFromArray(
            pipeTransport.pipeProgram,
            pipeTransport.pipeArgs,
            true
        );

        expect(pipeCmd).toStrictEqual('C:\\System32\\bash.exe -c "' + RemoteAttachPicker.scriptShellCmd + '"');
    });

    test('WSL with array arguments and no quote args', () => {
        const pipeTransport = GetWindowsWSLLaunchJSONWithArrayArgs();

        const pipeCmd = RemoteAttachPicker.createPipeCmdFromArray(
            pipeTransport.pipeProgram,
            pipeTransport.pipeArgs,
            false
        );

        expect(pipeCmd).toStrictEqual('C:\\System32\\bash.exe -c ' + RemoteAttachPicker.scriptShellCmd);
    });

    test('WSL with array arguments + debugger command and quote args', () => {
        const pipeTransport = GetWindowsWSLLaunchJSONWithArrayArgsAndDebuggerCommand();

        const pipeCmd = RemoteAttachPicker.createPipeCmdFromArray(
            pipeTransport.pipeProgram,
            pipeTransport.pipeArgs,
            true
        );

        expect(pipeCmd).toStrictEqual(
            'C:\\System32\\bash.exe -c "' + RemoteAttachPicker.scriptShellCmd + '" -- ignored'
        );
    });

    test('WSL with array arguments + debugger command and no quote args', () => {
        const pipeTransport = GetWindowsWSLLaunchJSONWithArrayArgsAndDebuggerCommand();

        const pipeCmd = RemoteAttachPicker.createPipeCmdFromArray(
            pipeTransport.pipeProgram,
            pipeTransport.pipeArgs,
            false
        );

        expect(pipeCmd).toStrictEqual('C:\\System32\\bash.exe -c ' + RemoteAttachPicker.scriptShellCmd + ' -- ignored');
    });

    test('WSL with string arguments and quote args', () => {
        const pipeTransport = GetWindowsWSLLaunchJSONWithStringArgs();

        const pipeCmd = RemoteAttachPicker.createPipeCmdFromString(
            pipeTransport.pipeProgram,
            pipeTransport.pipeArgs,
            true
        );

        expect(pipeCmd).toStrictEqual('C:\\System32\\bash.exe -c "' + RemoteAttachPicker.scriptShellCmd + '"');
    });

    test('WSL with string arguments and no quote args', () => {
        const pipeTransport = GetWindowsWSLLaunchJSONWithStringArgs();

        const pipeCmd = RemoteAttachPicker.createPipeCmdFromString(
            pipeTransport.pipeProgram,
            pipeTransport.pipeArgs,
            false
        );

        expect(pipeCmd).toStrictEqual('C:\\System32\\bash.exe -c ' + RemoteAttachPicker.scriptShellCmd);
    });

    test('WSL with string arguments + debugger command and quote args', () => {
        const pipeTransport = GetWindowsWSLLaunchJSONWithStringArgsAndDebuggerCommand();

        const pipeCmd = RemoteAttachPicker.createPipeCmdFromString(
            pipeTransport.pipeProgram,
            pipeTransport.pipeArgs,
            true
        );

        expect(pipeCmd).toStrictEqual('C:\\System32\\bash.exe -c ' + RemoteAttachPicker.scriptShellCmd + ' -- ignored');
    });

    test('WSL with string arguments + debugger command and no quote args', () => {
        const pipeTransport = GetWindowsWSLLaunchJSONWithStringArgsAndDebuggerCommand();

        const pipeCmd = RemoteAttachPicker.createPipeCmdFromString(
            pipeTransport.pipeProgram,
            pipeTransport.pipeArgs,
            false
        );

        expect(pipeCmd).toStrictEqual('C:\\System32\\bash.exe -c ' + RemoteAttachPicker.scriptShellCmd + ' -- ignored');
    });

    test('Windows Docker with string args, debuggerCommand', () => {
        const pipeTransport = GetWindowsDockerLaunchJSONWithStringArgsAndDebuggerCommand();

        // quoteArgs flag should be ignored
        const pipeCmd = RemoteAttachPicker.createPipeCmdFromString(
            pipeTransport.pipeProgram,
            pipeTransport.pipeArgs,
            pipeTransport.quoteArgs
        );

        expect(pipeCmd).toStrictEqual('docker -i exec 1234567 ' + RemoteAttachPicker.scriptShellCmd);
    });

    test('Windows Docker with array args', () => {
        const pipeTransport = GetWindowsDockerLaunchJSONWithArrayArgs();

        const pipeCmd = RemoteAttachPicker.createPipeCmdFromArray(
            pipeTransport.pipeProgram,
            pipeTransport.pipeArgs,
            pipeTransport.quoteArgs
        );

        expect(pipeCmd).toStrictEqual('docker -i exec 1234567 ' + RemoteAttachPicker.scriptShellCmd);
    });

    test('Windows Docker with array args with quotes', () => {
        const pipeTransport = GetWindowsDockerLaunchJSONWithArrayArgs();

        const pipeCmd = RemoteAttachPicker.createPipeCmdFromArray(
            pipeTransport.pipeProgram,
            pipeTransport.pipeArgs,
            true
        );

        expect(pipeCmd).toStrictEqual('docker -i exec 1234567 "' + RemoteAttachPicker.scriptShellCmd + '"');
    });

    test('Linux dotnet with array args and spaces', () => {
        const pipeTransport = GetLinuxLaunchJSONWithArrayArgs();

        const pipeCmd = RemoteAttachPicker.createPipeCmdFromArray(
            pipeTransport.pipeProgram,
            pipeTransport.pipeArgs,
            true
        );

        expect(pipeCmd).toStrictEqual(
            `/usr/bin/shared/dotnet bin/framework/myprogram.dll "argument with spaces" "${RemoteAttachPicker.scriptShellCmd}"`
        );
    });

    test('Multiple ${debuggerCommand} in string args', () => {
        const pipeCmd = RemoteAttachPicker.createPipeCmdFromString(
            'program.exe',
            ''.concat(
                RemoteAttachPicker.debuggerCommand,
                ' ',
                RemoteAttachPicker.debuggerCommand,
                ' ',
                RemoteAttachPicker.debuggerCommand
            ),
            true
        );

        expect(pipeCmd).toStrictEqual(
            'program.exe ' +
                RemoteAttachPicker.scriptShellCmd +
                ' ' +
                RemoteAttachPicker.scriptShellCmd +
                ' ' +
                RemoteAttachPicker.scriptShellCmd
        );
    });

    test('Multiple ${debuggerCommand} in array args', () => {
        const pipeCmd = RemoteAttachPicker.createPipeCmdFromArray(
            'program.exe',
            [
                RemoteAttachPicker.debuggerCommand,
                RemoteAttachPicker.debuggerCommand,
                RemoteAttachPicker.debuggerCommand,
            ],
            true
        );

        expect(pipeCmd).toStrictEqual(
            'program.exe "' +
                RemoteAttachPicker.scriptShellCmd +
                '" "' +
                RemoteAttachPicker.scriptShellCmd +
                '" "' +
                RemoteAttachPicker.scriptShellCmd +
                '"'
        );
    });

    test('OS Specific Configurations', () => {
        const launch = GetOSSpecificJSON();

        let pipeTransport = RemoteAttachPicker.getPipeTransportOptions(launch, 'win32');

        expect(pipeTransport.pipeProgram).toStrictEqual('Windows pipeProgram');
        expect(pipeTransport.pipeArgs).toStrictEqual('windows');

        pipeTransport = RemoteAttachPicker.getPipeTransportOptions(launch, 'darwin');

        expect(pipeTransport.pipeProgram).toStrictEqual('OSX pipeProgram');
        expect(pipeTransport.pipeArgs).toStrictEqual(['osx']);

        pipeTransport = RemoteAttachPicker.getPipeTransportOptions(launch, 'linux');

        expect(pipeTransport.pipeProgram).toStrictEqual('Linux pipeProgram');
        // Linux pipeTransport does not have args defined, should use the one defined in pipeTransport.
        expect(pipeTransport.pipeArgs).toStrictEqual([]);
    });

    test('Parse valid CIM output', () => {
        // output from the command used in CimAttachItemsProvider
        const cimOutput: string = String.raw`[
  {
    "Name": "System Idle Process",
    "ProcessId": 0,
    "CommandLine": null
  },
  {
    "Name": "WindowsTerminal.exe",
    "ProcessId": 5112,
    "CommandLine": "\"C:\\Program Files\\WindowsApps\\Microsoft.WindowsTerminalPreview_1.12.2931.0_x64__8wekyb3d8bbwe\\WindowsTerminal.exe\""
  },
  {
    "Name": "conhost.exe",
    "ProcessId": 34560,
    "CommandLine": "\\\\?\\C:\\WINDOWS\\system32\\conhost.exe --headless --width 80 --height 30 --signal 0x8e0 --server 0x824"
  },
  {
    "Name": "conhost.exe",
    "ProcessId": 33732,
    "CommandLine": "\\??\\C:\\WINDOWS\\system32\\conhost.exe 0x4"
  }
]`;

        const parsedOutput: Process[] = CimProcessParser.ParseProcessFromCim(cimOutput);

        expect(parsedOutput.length).toEqual(4);

        const process1: Process = parsedOutput[0];
        const process2: Process = parsedOutput[1];
        const process3: Process = parsedOutput[2];
        const process4: Process = parsedOutput[3];

        expect(process1.commandLine).not.toBeDefined();
        expect(process1.name).toEqual('System Idle Process');
        expect(process1.pid).toEqual('0');

        expect(process2.commandLine!).toEqual(
            '"C:\\Program Files\\WindowsApps\\Microsoft.WindowsTerminalPreview_1.12.2931.0_x64__8wekyb3d8bbwe\\WindowsTerminal.exe"'
        );
        expect(process2.name).toEqual('WindowsTerminal.exe');
        expect(process2.pid).toEqual('5112');

        expect(process3.commandLine!).toEqual(
            'C:\\WINDOWS\\system32\\conhost.exe --headless --width 80 --height 30 --signal 0x8e0 --server 0x824'
        );
        expect(process3.name).toEqual('conhost.exe');
        expect(process3.pid).toEqual('34560');

        expect(process4.commandLine!).toEqual('C:\\WINDOWS\\system32\\conhost.exe 0x4');
        expect(process4.name).toEqual('conhost.exe');
        expect(process4.pid).toEqual('33732');
    });
});

function GetWindowsWSLLaunchJSONWithArrayArgs() {
    return {
        pipeCwd: '${workspaceFolder}',
        pipeProgram: 'C:\\System32\\bash.exe',
        pipeArgs: ['-c'],
    };
}

function GetWindowsWSLLaunchJSONWithArrayArgsAndDebuggerCommand() {
    return {
        pipeCwd: '${workspaceFolder}',
        pipeProgram: 'C:\\System32\\bash.exe',
        pipeArgs: ['-c', '${debuggerCommand}', '--', 'ignored'],
    };
}

function GetWindowsWSLLaunchJSONWithStringArgs() {
    return {
        pipeCwd: '${workspaceFolder}',
        pipeProgram: 'C:\\System32\\bash.exe',
        pipeArgs: '-c',
    };
}

function GetWindowsWSLLaunchJSONWithStringArgsAndDebuggerCommand() {
    return {
        pipeCwd: '${workspaceFolder}',
        pipeProgram: 'C:\\System32\\bash.exe',
        pipeArgs: '-c ${debuggerCommand} -- ignored',
    };
}

function GetWindowsDockerLaunchJSONWithArrayArgs() {
    return {
        pipeCwd: '${workspaceFolder}',
        pipeProgram: 'docker',
        pipeArgs: ['-i', 'exec', '1234567'],
        quoteArgs: false,
    };
}

function GetWindowsDockerLaunchJSONWithStringArgsAndDebuggerCommand() {
    return {
        pipeCwd: '${workspaceFolder}',
        pipeProgram: 'docker',
        pipeArgs: '-i exec 1234567 ${debuggerCommand}',
        quoteArgs: false,
    };
}

function GetLinuxLaunchJSONWithArrayArgs() {
    return {
        pipeCwd: '${workspaceFolder}',
        pipeProgram: '/usr/bin/shared/dotnet',
        pipeArgs: ['bin/framework/myprogram.dll', 'argument with spaces'],
        quoteArg: true,
    };
}

function GetOSSpecificJSON() {
    return {
        pipeCwd: '${workspaceFolder}',
        pipeProgram: 'pipeProgram',
        pipeArgs: <string[]>[],
        windows: {
            pipeProgram: 'Windows pipeProgram',
            pipeArgs: 'windows',
        },
        osx: {
            pipeProgram: 'OSX pipeProgram',
            pipeArgs: ['osx'],
        },
        linux: {
            pipeProgram: 'Linux pipeProgram',
        },
    };
}
