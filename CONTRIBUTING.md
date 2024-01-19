## Table of Contents

- [Setting Up Local Development Environment](#setting-up-local-development-environment)
  - [Prerequisites for Development](#prerequisites-for-development)
  - [Building, Running, and Testing the Repository](#building-running-and-testing-the-repository)
  - [Setting Up Local Language Servers](#setting-up-local-language-servers)
    - [Roslyn](#roslyn)
    - [Razor](#razor)
  - [Configuring Local Language Servers](#configuring-local-language-servers)
    - [Roslyn](#roslyn-1)
    - [Razor](#razor-1)
  - [Debugging Local Language Servers](#debugging-local-language-servers)
- [Creating VSIX Packages for the Extension](#creating-vsix-packages-for-the-extension)
- [Updating the `Roslyn` Language Server Version](#updating-the-roslyn-language-server-version)

## Setting Up Local Development Environment

Setting up your local development environment for the vscode-csharp repository involves several steps. This guide will walk you through the process.

### Prerequisites for Development

Before you start, make sure you have the following software installed on your machine:

* Node.js ([v18.17.0 LTS](https://nodejs.org/en/blog/release/v18.17.0) is recommended).
* Npm (The version shipped with node is fine)
* .NET 8.0 SDK (dotnet should be on your path)

Once you have these installed, you can proceed to clone the vscode-csharp repository:

```bash
git clone https://github.com/your-username/vscode-csharp.git
cd vscode-csharp
```

Next, install the necessary npm packages:

```bash
npm install
```

Now, you're ready to start building, running, and testing the repository.

### Building, Running, and Testing the Repository

Follow these steps to build, run, and test the repository:

#### Building

1. Run `npm i` - This command installs the project dependencies.
2. Run `npm i -g gulp` - This command installs Gulp globally.
3. Run `gulp installDependencies` - This command downloads the various dependencies as specified by the version in the [package.json](package.json) file.
4. Run `code .` - This command opens the project in Visual Studio Code.
5. Run `npm run watch` (Optional) - This command watches for code changes.

#### Running

After completing the build steps:

1. Press <kbd>Ctrl+Shift+D</kbd> to open the Run view in VS Code and ensure `Launch Extension` is selected.
2. Start debugging by pressing <kbd>F5</kbd>.

#### Testing

To run tests:

1. Execute `npm run test` or press <kbd>F5</kbd> in VS Code with the "Launch Tests" debug configuration selected.
2. For integration tests, select `Razor Integration Tests` and press <kbd>F5</kbd> to start debugging.

### Setting Up Local Language Servers

This section shows how to set up local Razor or Roslyn language servers for debugging with the VSCode C# extension.

#### Roslyn

1. Clone the [Roslyn repository](https://github.com/dotnet/roslyn). This repository contains the Roslyn server implementation.
2. Follow the build instructions provided in the repository.

The server DLL is typically at `$roslynRepoRoot/artifacts/bin/Microsoft.CodeAnalysis.LanguageServer/Debug/net7.0/Microsoft.CodeAnalysis.LanguageServer.dll`, but this may vary based on the built configuration.

#### Razor

1. Clone the [Razor repository](https://github.com/dotnet/razor). This repository contains the Razor server implementation.
2. Follow the build instructions provided in the repository.

The server DLL is typically at `$razorRepoRoot/artifacts/bin/rzls/Debug/net8.0`.

### Configuring Local Language Servers

This section provides instructions on how to debug locally built Roslyn and Razor language servers. You can do this by either directly editing the `settings.json` file or through the VSCode settings interface.

#### Roslyn

1. Navigate to `C:\Users\YourUsername\AppData\Roaming\Code\User\settings.json` and add the following lines:

```json
"dotnet.server.waitForDebugger": true,
"dotnet.server.path": "$roslynRepoRoot\\artifacts\\bin\\Microsoft.CodeAnalysis.LanguageServer\\Debug\\net7.0\\Microsoft.CodeAnalysis.LanguageServer.dll"
```

Replace `$roslynRepoRoot` and `YourUsername` with your actual values.

Or, in VSCode settings (`Ctrl+,`):

1. Search for `dotnet server`.
2. Set `dotnet.server.path` to the path of your Roslyn DLL.
3. Enable `dotnet.server.waitForDebugger`.

#### Razor

1. Navigate to `C:\Users\YourUsername\AppData\Roaming\Code\User\settings.json` and add the following lines:

```json
"razor.languageServer.debug": true,
"razor.languageServer.directory": "$razorRepoRoot\\artifacts\\bin\\rzls\\Debug\\net8.0",
"razor.server.trace": "Debug"
```

Replace `$razorRepoRoot` and `YourUsername` with your actual values.

Or, in VSCode settings (`Ctrl+,`):

1. Search for `Razor`.
2. Set `razor.languageServer.directory` to the path of your Razor DLL.
3. Enable `razor.languageServer.debug`.
4. Set `razor.server.trace` to `Debug`. This gives you more detailed log messages in the output window.

### Debugging Local Language Servers

Before running the language servers, ensure you have followed the steps in the [Configuring Local Language Servers](#configuring-local-language-servers) section to configure either the Roslyn or Razor language servers for debugging.

After completing the configuration, follow these steps:

1. Ensure the language server is fully built in Debug mode.
2. Open the `.sln` solution file for the language server in a Visual Studio instance. Keep this instance open for use in a later step.
3. Press `Ctrl+Shift+P` and select `Reload Window`. This ensures the changes from the configuration step are applied.
4. After reloading, a window will pop up prompting you to select or open a Visual Studio instance. Click `Cancel` at this stage. This is because we want to debug the child VS Code instance that will open after the next step, not the current instance.
5. Press `Ctrl+Shift+D` and then `F5` to launch the extension. The window from step 4 will appear again, prompting you to select or open a Visual Studio instance. Now, select the instance you opened in step 2.
6. The language server will now trigger a breakpoint on `Debugger.Launch()` when it starts.

## Creating VSIX Packages for the Extension

To package this extension, we need to create VSIX Packages. The VSIX packages can be created using the gulp command `gulp vsix:release:package`. This will create all the platform specific VSIXs that you can then install manually in VSCode.

## Updating the `Roslyn` Language Server Version

To update the version of the roslyn server used by the extension do the following:
1.  Find the the Roslyn signed build you want from [here](https://dnceng.visualstudio.com/internal/_build?definitionId=327&_a=summary).  Typically the latest successful build of main is fine.
2.  In the official build stage, look for the `Publish Assets` step.  In there you will see it publishing the `Microsoft.CodeAnalysis.LanguageServer.neutral` package with some version, e.g. `4.6.0-3.23158.4`.  Take note of that version number.
3.  In the [package.json](package.json) inside the `defaults` section update the `roslyn` key to point to the version number you found above in step 2.
4.  Ensure that version of the package is in the proper feeds by running `gulp updateRoslynVersion`. Note: you may need to install the [Azure Artifacts NuGet Credential Provider](https://github.com/microsoft/artifacts-credprovider#installation-on-windows) to run interactive authentication.
5.  Build and test the change. If everything looks good, submit a PR.
