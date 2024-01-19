## Table of Contents

- [Setting Up Local Development Environment](#setting-up-local-development-environment)
  - [Prerequisites for Development](#prerequisites-for-development)
  - [Building, Running, and Testing the Repository](#building-running-and-testing-the-repository)
  - [Setting Up Local Language Servers](#setting-up-local-language-servers)
    - [Roslyn](#roslyn)
    - [Razor](#razor)
  - [Debugging Local Language Servers](#debugging-local-language-servers)
    - [Roslyn](#roslyn-1)
    - [Razor](#razor-1)
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

This section provides a step-by-step guide on setting up locally developed Razor or Roslyn language servers for debugging. This setup is beneficial when troubleshooting the behavior of these language servers with the VSCode C# extension.

#### Roslyn

1. Clone the [Roslyn repository](https://github.com/dotnet/roslyn) locally. This repository contains the Roslyn server implementation.
2. Follow the build instructions provided in the repository.

After building, you can find the server DLL in the build output directory. The typical location is `$roslynRepoRoot/artifacts/bin/Microsoft.CodeAnalysis.LanguageServer/Debug/net8.0/Microsoft.CodeAnalysis.LanguageServer.dll`, but this may vary based on the built configuration.

#### Razor

1. Clone the [Razor repository](https://github.com/dotnet/razor) locally. This repository contains the Razor server implementation.
2. Follow the build instructions provided in the repository.

Similar to Roslyn, after building, the server DLL will be in the build output directory. The typical location is `$razorRepoRoot/artifacts/bin/rzls/Debug/net8.0`, but this may vary based on the built configuration.

### Debugging Local Language Servers

This section provides instructions on how to debug locally developed Roslyn and Razor language servers.

#### Roslyn

1. Open the VSCode settings by using the shortcut `Ctrl+,`.
2. Enter `dotnet server` in the search box to display Roslyn-related settings.
3. Update the `dotnet.server.path` setting to the path of the Roslyn DLL you built earlier, then restart the language server.
4. If you need to debug the server, enable the `dotnet.server.waitForDebugger` setting. This action triggers a `Debugger.Launch()` on the server side when it starts.

#### Razor

1. Open the VSCode settings by using the shortcut `Ctrl+,`.
2. Enter `Razor` in the search box to display Razor-related settings.
3. Update the `razor.languageServer.directory` setting to the path of the Razor DLL you built earlier, then restart the language server.
4. If you need to debug the server, enable the `razor.languageServer.debug` setting. This action triggers a `Debugger.Launch()` on the server side when it starts.
5. For more detailed log messages in the output window, set `razor.server.trace` to `Debug`.

### Creating VSIX Packages for the Extension

To package this extension, we need to create VSIX Packages. The VSIX packages can be created using the gulp command `gulp vsix:release:package`. This will create all the platform specific VSIXs that you can then install manually in VSCode.

## Updating the `Roslyn` Language Server Version

To update the version of the roslyn server used by the extension do the following:
1.  Find the the Roslyn signed build you want from [here](https://dnceng.visualstudio.com/internal/_build?definitionId=327&_a=summary).  Typically the latest successful build of main is fine.
2.  In the official build stage, look for the `Publish Assets` step.  In there you will see it publishing the `Microsoft.CodeAnalysis.LanguageServer.neutral` package with some version, e.g. `4.6.0-3.23158.4`.  Take note of that version number.
3.  In the [package.json](package.json) inside the `defaults` section update the `roslyn` key to point to the version number you found above in step 2.
4.  Ensure that version of the package is in the proper feeds by running `gulp updateRoslynVersion`. Note: you may need to install the [Azure Artifacts NuGet Credential Provider](https://github.com/microsoft/artifacts-credprovider#installation-on-windows) to run interactive authentication.
5.  Build and test the change. If everything looks good, submit a PR.
