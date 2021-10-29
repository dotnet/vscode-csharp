/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RemoteAttachPicker, Process, CimProcessParser } from '../../src/features/processPicker';
import { should } from 'chai';

suite("Remote Process Picker: Validate quoting arguments.", () => {
    suiteSetup(() => should());
    test("Argument with no spaces", () => {
        let nonQuotedArg = RemoteAttachPicker.quoteArg("C:\\Users\\nospace\\program.exe");

        nonQuotedArg.should.deep.equal("C:\\Users\\nospace\\program.exe");
    });

    test("Argument with spaces", () => {
        let nonQuotedArg = RemoteAttachPicker.quoteArg("C:\\Users\\s p a c e\\program.exe");

        nonQuotedArg.should.deep.equal("\"C:\\Users\\s p a c e\\program.exe\"");
    });

    test("Argument with spaces with no quotes", () => {
        let nonQuotedArg = RemoteAttachPicker.quoteArg("C:\\Users\\s p a c e\\program.exe", false);

        nonQuotedArg.should.deep.equal("C:\\Users\\s p a c e\\program.exe");
    });

    test("WSL with array arguments and quote args", () => {
        let pipeTransport = GetWindowsWSLLaunchJSONWithArrayArgs();

        let pipeCmd = RemoteAttachPicker.createPipeCmdFromArray(pipeTransport.pipeProgram, pipeTransport.pipeArgs, true);

        pipeCmd.should.deep.equal("C:\\System32\\bash.exe -c \"" + RemoteAttachPicker.scriptShellCmd + "\"");
    });

    test("WSL with array arguments and no quote args", () => {
        let pipeTransport = GetWindowsWSLLaunchJSONWithArrayArgs();

        let pipeCmd = RemoteAttachPicker.createPipeCmdFromArray(pipeTransport.pipeProgram, pipeTransport.pipeArgs, false);

        pipeCmd.should.deep.equal("C:\\System32\\bash.exe -c " + RemoteAttachPicker.scriptShellCmd);
    });

    test("WSL with array arguments + debugger command and quote args", () => {
        let pipeTransport = GetWindowsWSLLaunchJSONWithArrayArgsAndDebuggerCommand();

        let pipeCmd = RemoteAttachPicker.createPipeCmdFromArray(pipeTransport.pipeProgram, pipeTransport.pipeArgs, true);

        pipeCmd.should.deep.equal("C:\\System32\\bash.exe -c \"" + RemoteAttachPicker.scriptShellCmd + "\" -- ignored");
    });

    test("WSL with array arguments + debugger command and no quote args", () => {
        let pipeTransport = GetWindowsWSLLaunchJSONWithArrayArgsAndDebuggerCommand();

        let pipeCmd = RemoteAttachPicker.createPipeCmdFromArray(pipeTransport.pipeProgram, pipeTransport.pipeArgs, false);

        pipeCmd.should.deep.equal("C:\\System32\\bash.exe -c " + RemoteAttachPicker.scriptShellCmd + " -- ignored");
    });

    test("WSL with string arguments and quote args", () => {
        let pipeTransport = GetWindowsWSLLaunchJSONWithStringArgs();

        let pipeCmd = RemoteAttachPicker.createPipeCmdFromString(pipeTransport.pipeProgram, pipeTransport.pipeArgs, true);

        pipeCmd.should.deep.equal("C:\\System32\\bash.exe -c \"" + RemoteAttachPicker.scriptShellCmd + "\"");
    });

    test("WSL with string arguments and no quote args", () => {
        let pipeTransport = GetWindowsWSLLaunchJSONWithStringArgs();

        let pipeCmd = RemoteAttachPicker.createPipeCmdFromString(pipeTransport.pipeProgram, pipeTransport.pipeArgs, false);

        pipeCmd.should.deep.equal("C:\\System32\\bash.exe -c " + RemoteAttachPicker.scriptShellCmd);
    });

    test("WSL with string arguments + debugger command and quote args", () => {
        let pipeTransport = GetWindowsWSLLaunchJSONWithStringArgsAndDebuggerCommand();

        let pipeCmd = RemoteAttachPicker.createPipeCmdFromString(pipeTransport.pipeProgram, pipeTransport.pipeArgs, true);

        pipeCmd.should.deep.equal("C:\\System32\\bash.exe -c " + RemoteAttachPicker.scriptShellCmd + " -- ignored");
    });

    test("WSL with string arguments + debugger command and no quote args", () => {
        let pipeTransport = GetWindowsWSLLaunchJSONWithStringArgsAndDebuggerCommand();

        let pipeCmd = RemoteAttachPicker.createPipeCmdFromString(pipeTransport.pipeProgram, pipeTransport.pipeArgs, false);

        pipeCmd.should.deep.equal("C:\\System32\\bash.exe -c " + RemoteAttachPicker.scriptShellCmd + " -- ignored");
    });

    test("Windows Docker with string args, debuggerCommand", () => {
        let pipeTransport = GetWindowsDockerLaunchJSONWithStringArgsAndDebuggerCommand();

        // quoteArgs flag should be ignored
        let pipeCmd = RemoteAttachPicker.createPipeCmdFromString(pipeTransport.pipeProgram, pipeTransport.pipeArgs, pipeTransport.quoteArgs);

        pipeCmd.should.deep.equal("docker -i exec 1234567 " + RemoteAttachPicker.scriptShellCmd);
    });

    test("Windows Docker with array args", () => {
        let pipeTransport = GetWindowsDockerLaunchJSONWithArrayArgs();

        let pipeCmd = RemoteAttachPicker.createPipeCmdFromArray(pipeTransport.pipeProgram, pipeTransport.pipeArgs, pipeTransport.quoteArgs);

        pipeCmd.should.deep.equal("docker -i exec 1234567 " + RemoteAttachPicker.scriptShellCmd);

    });

    test("Windows Docker with array args with quotes", () => {
        let pipeTransport = GetWindowsDockerLaunchJSONWithArrayArgs();

        let pipeCmd = RemoteAttachPicker.createPipeCmdFromArray(pipeTransport.pipeProgram, pipeTransport.pipeArgs, true);

        pipeCmd.should.deep.equal("docker -i exec 1234567 \"" + RemoteAttachPicker.scriptShellCmd + "\"");

    });

    test("Linux dotnet with array args and spaces", () => {
        let pipeTransport = GetLinuxLaunchJSONWithArrayArgs();

        let pipeCmd = RemoteAttachPicker.createPipeCmdFromArray(pipeTransport.pipeProgram, pipeTransport.pipeArgs, true);

        pipeCmd.should.deep.equal(`/usr/bin/shared/dotnet bin/framework/myprogram.dll \"argument with spaces\" \"${RemoteAttachPicker.scriptShellCmd}\"`);
    });

    test("Multiple ${debuggerCommand} in string args", () => {
        let pipeCmd = RemoteAttachPicker.createPipeCmdFromString("program.exe", "".concat(RemoteAttachPicker.debuggerCommand, " ", RemoteAttachPicker.debuggerCommand, " ", RemoteAttachPicker.debuggerCommand), true);

        pipeCmd.should.deep.equal("program.exe " + RemoteAttachPicker.scriptShellCmd + " " + RemoteAttachPicker.scriptShellCmd + " " + RemoteAttachPicker.scriptShellCmd);
    });

    test("Multiple ${debuggerCommand} in array args", () => {
        let pipeCmd = RemoteAttachPicker.createPipeCmdFromArray("program.exe", [RemoteAttachPicker.debuggerCommand, RemoteAttachPicker.debuggerCommand, RemoteAttachPicker.debuggerCommand], true);

        pipeCmd.should.deep.equal("program.exe \"" + RemoteAttachPicker.scriptShellCmd + "\" \"" + RemoteAttachPicker.scriptShellCmd + "\" \"" + RemoteAttachPicker.scriptShellCmd + "\"");
    });

    test("OS Specific Configurations", () => {
        let launch = GetOSSpecificJSON();

        let pipeTransport = RemoteAttachPicker.getPipeTransportOptions(launch, "win32");

        pipeTransport.pipeProgram.should.deep.equal("Windows pipeProgram");
        pipeTransport.pipeArgs.should.deep.equal("windows");

        pipeTransport = RemoteAttachPicker.getPipeTransportOptions(launch, "darwin");

        pipeTransport.pipeProgram.should.deep.equal("OSX pipeProgram");
        pipeTransport.pipeArgs.should.deep.equal(["osx"]);

        pipeTransport = RemoteAttachPicker.getPipeTransportOptions(launch, "linux");

        pipeTransport.pipeProgram.should.deep.equal("Linux pipeProgram");
        // Linux pipeTransport does not have args defined, should use the one defined in pipeTransport.
        pipeTransport.pipeArgs.should.deep.equal([]);

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

        parsedOutput.length.should.equal(4);

        const process1: Process = parsedOutput[0];
        const process2: Process = parsedOutput[1];
        const process3: Process = parsedOutput[2];
        const process4: Process = parsedOutput[3];

        const should = require('chai').should();
        should.not.exist(process1.commandLine);
        process1.name.should.equal('System Idle Process');
        process1.pid.should.equal('0');

        process2.commandLine.should.equal('"C:\\Program Files\\WindowsApps\\Microsoft.WindowsTerminalPreview_1.12.2931.0_x64__8wekyb3d8bbwe\\WindowsTerminal.exe"');
        process2.name.should.equal('WindowsTerminal.exe');
        process2.pid.should.equal('5112');

        process3.commandLine.should.equal('C:\\WINDOWS\\system32\\conhost.exe --headless --width 80 --height 30 --signal 0x8e0 --server 0x824');
        process3.name.should.equal('conhost.exe');
        process3.pid.should.equal('34560');

        process4.commandLine.should.equal('C:\\WINDOWS\\system32\\conhost.exe 0x4');
        process4.name.should.equal('conhost.exe');
        process4.pid.should.equal('33732');
    });
});

function GetWindowsWSLLaunchJSONWithArrayArgs() {
    return {
        pipeCwd: "${workspaceFolder}",
        pipeProgram: "C:\\System32\\bash.exe",
        pipeArgs: ["-c"]
    };
}

function GetWindowsWSLLaunchJSONWithArrayArgsAndDebuggerCommand() {
    return {
        pipeCwd: "${workspaceFolder}",
        pipeProgram: "C:\\System32\\bash.exe",
        pipeArgs: ["-c", "${debuggerCommand}", "--", "ignored"]
    };
}

function GetWindowsWSLLaunchJSONWithStringArgs() {
    return {
        pipeCwd: "${workspaceFolder}",
        pipeProgram: "C:\\System32\\bash.exe",
        pipeArgs: "-c"
    };
}

function GetWindowsWSLLaunchJSONWithStringArgsAndDebuggerCommand() {
    return {
        pipeCwd: "${workspaceFolder}",
        pipeProgram: "C:\\System32\\bash.exe",
        pipeArgs: "-c ${debuggerCommand} -- ignored"
    };
}

function GetWindowsDockerLaunchJSONWithArrayArgs() {
    return {
        pipeCwd: "${workspaceFolder}",
        pipeProgram: "docker",
        pipeArgs: ["-i", "exec", "1234567"],
        quoteArgs: false
    };
}

function GetWindowsDockerLaunchJSONWithStringArgsAndDebuggerCommand() {
    return {
        pipeCwd: "${workspaceFolder}",
        pipeProgram: "docker",
        pipeArgs: "-i exec 1234567 ${debuggerCommand}",
        quoteArgs: false
    };
}

function GetLinuxLaunchJSONWithArrayArgs() {
    return {
        pipeCwd: "${workspaceFolder}",
        pipeProgram: "/usr/bin/shared/dotnet",
        pipeArgs: ["bin/framework/myprogram.dll", "argument with spaces"],
        quoteArg: true
    };
}

function GetOSSpecificJSON() {
    return {
        pipeCwd: "${workspaceFolder}",
        pipeProgram: "pipeProgram",
        pipeArgs: <string[]>[],
        windows: {
            pipeProgram: "Windows pipeProgram",
            pipeArgs: "windows"
        },
        osx: {
            pipeProgram: "OSX pipeProgram",
            pipeArgs: ["osx"]
        },
        linux: {
            pipeProgram: "Linux pipeProgram",
        }
    };
}