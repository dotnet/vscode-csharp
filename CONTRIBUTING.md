## Local development

### Pre-requisites

First install:

* Node.js ([v18.17.0 LTS](https://nodejs.org/de/blog/release/v18.17.0) is recommended).
* Npm (The version shipped with node is fine)
* .NET 7.0 SDK (dotnet should be on your path)

### Build and run the extension

To run and develop the extension do the following:

* Run `npm i`
* Run `npm i -g gulp`
* Run `gulp installDependencies` (this will download the various dependencies as specified by the version in the [package.json](package.json))
* Open in Visual Studio Code (`code .`)
* _Optional:_ run `npm run watch`, make code changes
* Press <kbd>F5</kbd> to debug

To **test** do the following: `npm run test` or <kbd>F5</kbd> in VS Code with the "Launch Tests" debug configuration.

### Using a locally developed Roslyn server

https://github.com/dotnet/roslyn contains the server implementation.  Follow the instructions there to build the repo as normal.  Once built, the server DLL will be located in the build output directory, typically

`$roslynRepoRoot/artifacts/bin/Microsoft.CodeAnalysis.LanguageServer/Debug/net7.0/Microsoft.CodeAnalysis.LanguageServer.dll`

depending on which configuration is built.  Then, launch the extension here and change the VSCode setting `dotnet.server.path` to point to the Roslyn dll path you built above and restart the language server.

If you need to debug the server, you can set the VSCode setting `dotnet.server.waitForDebugger` to true.  This will trigger a `Debugger.Launch()` on the server side as it starts.

### Using a locally developed Razor server

https://github.com/dotnet/razor contains the server implementation.  Follow the instructions there to build the repo as normal.  Once built, the server will be located in the build output directory, typically

`$razorRepoRoot/artifacts/bin/rzls/Debug/net7.0`

depending on which configuration is built.  Then, launch the extension here and change the VSCode setting `razor.languageServer.directory` to point to the Razor executable path you built above and reload the window.

If you need to debug the server, you can set the VSCode setting `razor.languageServer.debug` to true.  This will trigger a `Debugger.Launch()` on the server side as it starts. You can also set `razor.trace` to `Verbose` to get more log messages in the output window

### Creating VSIXs

VSIXs can be created using the gulp command `gulp vsix:release:package`.  This will create all the platform specific VSIXs that you can then install manually in VSCode.

## Updating the Roslyn server version

To update the version of the roslyn server used by the extension do the following:
1.  Find the the Roslyn signed build you want from [here](https://dnceng.visualstudio.com/internal/_build?definitionId=327&_a=summary).  Typically the latest successful build of main is fine.
2.  In the official build stage, look for the `Publish Assets` step.  In there you will see it publishing the `Microsoft.CodeAnalysis.LanguageServer` package with some version, e.g. `4.6.0-3.23158.4`.  Take note of that version number.
3.  In the [package.json](package.json) inside the `defaults` section update the `roslyn` key to point to the version number you found above in step 2.
4.  Build and test the change (make sure to run `gulp installDependencies` to get the new version!).  If everything looks good, submit a PR.
    * Adding new package versions might require authentication, run with the `--interactive` flag to login.  You may need to install [azure artifacts nuget credential provider](https://github.com/microsoft/artifacts-credprovider#installation-on-windows) to run interactive authentication.
