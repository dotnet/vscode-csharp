The C# extension supports limited full .NET framework debugging. It can only debug 64-bit applications with [portable PDBs](https://github.com/OmniSharp/omnisharp-vscode/wiki/Portable-PDBs).

To enable the Desktop CLR debugger, change the configuration type in launch.json to be "clr" instead of "coreclr" and program should be pointing at the exe (**NOT** a .dll).

For unit tests, this can be done thusly:
1. File->Preferences->Settings
2. Open "CSharp: Unit Test Debugging Options"
3. Set the 'type' to 'clr' (see settings.json example below)
4. NOTE: For MSTest projects, also see [Forcing MSTest projects to use a 64-bit worker](https://github.com/OmniSharp/omnisharp-vscode/wiki/Desktop-.NET-Framework#forcing-mstest-projects-to-use-a-64-bit-worker) section.

## launch.json example

```
{
   ...
   "type": "clr",
   "program": "path\\to\\program.exe",
   ...
}
```

More information about debugging desktop .NET Framework can be found here, https://stackoverflow.com/questions/47707095.


## settings.json example

```
{
    ...
    "csharp.unitTestDebuggingOptions": {
        "type": "clr"
    }
}
```

## Forcing MSTest projects to use a 64-bit worker

Some versions of MSTest will use an x86 worker process to run tests, which is not supported by the debugger. This can result in error messages like: `Unable to start program '<some-path-here>\\testhost.net472.x86.exe'. Unknown Error: 0x80131c30` or `Unable to start program '<some-path-here>\\testhost.net472.x86.exe'. The .NET debugger can only debug x64 processes.`.

To fix this:
1. Create a '.runsettings' file such as the following
2. Add/modify a 'settings.json' file in the root of the workspace that points at the .runsettings file: `"omnisharp.testRunSettings": "C:\\My-workspace-root-here\\UseX64Worker.runsettings"`

#### Example .runsettings file
```xml
<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
  <RunConfiguration>
    <TargetPlatform>x64</TargetPlatform>
  </RunConfiguration>
</RunSettings>
```