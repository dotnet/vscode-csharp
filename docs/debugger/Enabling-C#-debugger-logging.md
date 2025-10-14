Here is how to enable additional logging for the VS Code C# debugger to help troubleshoot problems.

## VS Code Settings

The C# debugger exposes several logging setting via a [Visual Studio Code Setting](https://code.visualstudio.com/docs/getstarted/settings). To modify them:
1. Open up the VS Code settings editor (File->Preferences->Settings).
2. Enter 'diagnosticsLog' into the search bar
3. Navigate to 'Extensions->C#->Debugger' using the settings tree
4. Enable the required setting. The most commonly used logging setting is 'Protocol Messages'.

When this is enabled, logging will be sent to the VS Code Debug Console where you can copy/paste the relevant sections.

## Using launch.json
If you have VS Code configured using a launch.json file with `"type": "coreclr"` or `"type": "clr"`, then you can configure logging using launch configuration properties. Here is an example of the new sections to add to launch.json:

```json
    "configurations": [
        {
            "type": "coreclr",
            "...": "...",
            "logging": {
                "diagnosticsLog": {
                    "protocolMessages": true
                }
            }
        },
        { "...": "..." }
    ]
```

Just like when configured via a VS Code Setting, when this is enabled, logging will be sent to the VS Code Debug Console where you can copy/paste the relevant sections.

## Full Method
If you are dealing with a problem that happens either very early on during debugger startup, or a problem where the debugger is crashing, it can be helpful to run the debugger (vsdbg-ui) in the console.

To do this:

1. Open up a terminal (command prompt) window
2. Change to the directory of the debugger. (NOTE: if you are using VS Code Insiders, change `.vscode` to `.vscode-insiders`)
    * **Linux**: `cd ~/.vscode/extensions/ms-dotnettools.csharp-<insert-version-here>-<insert-platform-here>/.debugger`
    * **macOS**: `cd ~/.vscode/extensions/ms-dotnettools.csharp-<insert-version-here>-<insert-platform-here>/.debugger/<x86_64|arm64>`
    * **Windows**: `cd /d C:\Users\<your-username>\.vscode\extensions\ms-dotnettools.csharp-<insert-version-here>-<insert-platform-here>\.debugger\<x86_64|arm64>`
3. Run vsdbg-ui: `./vsdbg-ui --server --consoleLogging`
4. Go back to VS Code and open your `.vscode\launch.json` file.
5. Go to the section for of launch.json for your current launch configuration and add: `"debugServer": 4711`
6. Debug as normal
7. When the problem happens, look at what is printed into the terminal.

Example launch.json configuration:

```json
{
   "version": "0.2.0",
   "configurations": [
        {
            "debugServer": 4711,
            "name": ".NET Core Launch (console)",
            "...": "...",
        },
        { "...": "..." }
    ]
}
```
