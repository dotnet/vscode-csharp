## Local development

### Pre-requisites

First install:

* Node.js (8.11.1 or later)
* Npm (5.6.0 or later)

### Build and run the extension

To run and develop the extension do the following:

* Run `npm i`
* Run `npm i -g gulp`
* Run `gulp roslyn:languageserver` (this will download the Roslyn language server executables as specified by the version in the [package.json](package.json))
* _Optional:_ run `gulp razor:languageserver` to install the Razor language server.
* Open in Visual Studio Code (`code .`)
* _Optional:_ run `npm run watch`, make code changes
* Press <kbd>F5</kbd> to debug

To **test** do the following: `npm run test` or <kbd>F5</kbd> in VS Code with the "Launch Tests" debug configuration.

### Using a locally developed Roslyn server

https://dnceng.visualstudio.com/internal/_git/dotnet-roslyn?version=GBfeatures%2Flsp_tools_host contains the server implementation.  Follow the instructions there to build the repo as normal.  Once built, the server executable will be located in the build output directory, typically 

`$roslynRepoRoot/artifacts/bin/Microsoft.CodeAnalysis.LanguageServer/Debug/net7.0/Microsoft.CodeAnalysis.LanguageServer.exe`

depending on which configuration is built.  Then, launch the extension here and change the VSCode setting `dotnet.server.path` to point to the Roslyn executable path you built above and restart the language server.

### Creating VSIXs

VSIXs can be created using the gulp command `gulp vsix:release:package`.  This will create all the platform specific VSIXs that you can then install manually in VSCode.