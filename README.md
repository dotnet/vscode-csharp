## C# for Visual Studio Code (powered by OmniSharp)

Welcome to the C# extension for Visual Studio Code! This extension provides the following features inside VS Code:

* Lightweight development tools for [.NET Core](https://dotnet.github.io).
* Great C# editing support, including Syntax Highlighting, IntelliSense, Go to Definition, Find All References, etc.
* Debugging support for .NET Core (CoreCLR). NOTE: Mono debugging is not supported. Desktop CLR debugging has [limited support](https://github.com/OmniSharp/omnisharp-vscode/wiki/Desktop-.NET-Framework).
* Support for project.json and csproj projects on Windows, macOS and Linux.

The C# extension is powered by [OmniSharp](https://github.com/OmniSharp/omnisharp-roslyn).

### Requirements

- [.NET 6 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/6.0) or newer when `omnisharp.useModernNet` is set to `true` (the default value).
- A Full Framework runtime and MSBuild tooling when `omnisharp.useModernNet` is set to `false`.
  - Windows: .NET Framework along with [MSBuild Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
  - MacOS/Linux: [Mono with MSBuild](https://www.mono-project.com/download/preview/)

### Get Started Writing C# in VS Code

* [Documentation](https://code.visualstudio.com/docs/languages/csharp)
* [Video Tutorial compiling with .NET Core](https://channel9.msdn.com/Blogs/dotnet/Get-started-VSCode-Csharp-NET-Core-Windows)

## Announcements

### The C# extension no longer ships with an included Mono & MSBuild Tools

.NET Framework builds of OmniSharp no longer ship with Mono or the MSBuild tooling (See announcement [omnisharp-roslyn#2339](https://github.com/OmniSharp/omnisharp-roslyn/issues/2339)). To ensure that the C# extension remains usable out of the box for .NET SDK projects, we have changed the default value of `omnisharp.useModernNet` to `true`.

If you still need Unity or .NET Framework support, you can set `omnisharp.useModernNet` to `false` in your VS Code settings and restart OmniSharp. Please see the [Requirements](https://github.com/OmniSharp/omnisharp-vscode#requirements) section above to ensure necessary tooling is installed.

See issue [#5120](https://github.com/OmniSharp/omnisharp-vscode/issues/5120) for more details.

## What's new in 1.25.1
* Provide actionable error messages for .NET SDK issues ([#5223](https://github.com/OmniSharp/omnisharp-vscode/issues/5223), PR: [#5225](https://github.com/OmniSharp/omnisharp-vscode/pull/5225))
* Various debugger bug fixes including fixing an issue with [Source Link](https://aka.ms/sourcelink) with file paths that contain characters that need to be URL escaped ([#5290](https://github.com/OmniSharp/omnisharp-vscode/issues/5290)).

## What's new in 1.25.0
* Make SDK build of OmniSharp the default ([#5120](https://github.com/OmniSharp/omnisharp-vscode/issues/5120), PR: [#5176](https://github.com/OmniSharp/omnisharp-vscode/pull/5176))
* Add auto complete name to class, interface, enum, struct etc. snippets (PR: [#5198](https://github.com/OmniSharp/omnisharp-vscode/pull/5198))
* Add a fallback for ps in remoteProcessPickerScript ([#4096](https://github.com/OmniSharp/omnisharp-vscode/issues/4096), PR: [#5207](https://github.com/OmniSharp/omnisharp-vscode/pull/5207))
* Clear nullability warnings in server/omnisharp.ts (PR: [#5199](https://github.com/OmniSharp/omnisharp-vscode/pull/5199))
* Fix nullability for autoStart preferredPath (PR: [#5192](https://github.com/OmniSharp/omnisharp-vscode/pull/5192))
* coreclr debug configuration should support input variables for envFile ([#5102](https://github.com/OmniSharp/omnisharp-vscode/issues/5102), PR: [#5189](https://github.com/OmniSharp/omnisharp-vscode/pull/5189))
* Fix small spelling mistake (PR: [#5215](https://github.com/OmniSharp/omnisharp-vscode/pull/5215))
* Low-hanging nullable fruit (PR: [#5186](https://github.com/OmniSharp/omnisharp-vscode/pull/5186))
* Fire a buffer update instead of filechanged when active editor changes  ([#5216](https://github.com/OmniSharp/omnisharp-vscode/issues/5216), PR: [#5218](https://github.com/OmniSharp/omnisharp-vscode/pull/5218))
* Add support for InlayHint.TextEdits (PR: [#5177](https://github.com/OmniSharp/omnisharp-vscode/pull/5177))
* Fix .net6 OmniSharp acquisition on Linux arm64 (PR: [#5172](https://github.com/OmniSharp/omnisharp-vscode/pull/5172))
* Remove project.json reference in debugger.md (PR: [#5210](https://github.com/OmniSharp/omnisharp-vscode/pull/5210))
* Update debugger to 1.24.5 (PR: [#5211](https://github.com/OmniSharp/omnisharp-vscode/pull/5211))
  * Fixes [#5083](https://github.com/OmniSharp/omnisharp-vscode/issues/5083)
* Update OmniSharp to 1.39.0 (PR: [#5219](https://github.com/OmniSharp/omnisharp-vscode/pull/5219))
  * Update Roslyn to 4.3.0-2.22267.5 (PR: [omnisharp-roslyn#2401](https://github.com/OmniSharp/omnisharp-roslyn/pull/2401))
  * Fixed run script for Mono ([#5181](https://github.com/OmniSharp/omnisharp-vscode/issues/5181), [#5179](https://github.com/OmniSharp/omnisharp-vscode/issues/5179), PR: [omnisharp-roslyn##2398](https://github.com/OmniSharp/omnisharp-roslyn/pull/2398))
  * Fall back to /usr/lib/os-release if /etc/os-release doesn't exist (PR: [omnisharp-roslyn##2380](https://github.com/OmniSharp/omnisharp-roslyn/pull/2380))
  * Added support for linux-musl-x64 and linux-musl-arm64 ([omnisharp-roslyn##2366](https://github.com/OmniSharp/omnisharp-roslyn/issues/2366), PR: [omnisharp-roslyn##2395](https://github.com/OmniSharp/omnisharp-roslyn/pull/2395))
  * Enable GoToDefinition for symbols in metadata documents ([#4818](https://github.com/OmniSharp/omnisharp-vscode/issues/4818), PR: [omnisharp-roslyn##2390](https://github.com/OmniSharp/omnisharp-roslyn/pull/2390))
  * Use human readable doc in lsp's signature help ([omnisharp-roslyn##2372](https://github.com/OmniSharp/omnisharp-roslyn/issues/2372), PR: [omnisharp-roslyn##2392](https://github.com/OmniSharp/omnisharp-roslyn/pull/2392))
  * Add TextEdits support to InlayHints (PR: [omnisharp-roslyn##2385](https://github.com/OmniSharp/omnisharp-roslyn/pull/2385))
  * Fix Equals of AutoCompleteResponse and simplify some code (PR: [omnisharp-roslyn##2362](https://github.com/OmniSharp/omnisharp-roslyn/pull/2362))
  * Support O# running on .NET 7 SDKs (PR: [omnisharp-roslyn##2377](https://github.com/OmniSharp/omnisharp-roslyn/pull/2377))
  * Provide constructor accepting hostServices (PR: [omnisharp-roslyn##2373](https://github.com/OmniSharp/omnisharp-roslyn/pull/2373))
  * Typo fix ([omnisharp-roslyn##2374](https://github.com/OmniSharp/omnisharp-roslyn/pull/2374))
  * Update to latest .NET SDKs (PR: [omnisharp-roslyn##2378](https://github.com/OmniSharp/omnisharp-roslyn/pull/2378))
  * Remove MSBuild and Mono from release packages ([omnisharp-roslyn##2339](https://github.com/OmniSharp/omnisharp-roslyn/issues/2339), PR: [omnisharp-roslyn##2360](https://github.com/OmniSharp/omnisharp-roslyn/pull/2360))

## What's new in 1.24.4
* Remove inlayHints from diff view (PR: [#5151](https://github.com/OmniSharp/omnisharp-vscode/pull/5151))
* Quote arguments containing spaces when launching OmniSharp ([#5150](https://github.com/OmniSharp/omnisharp-vscode/issues/5150), PR: [#5154](https://github.com/OmniSharp/omnisharp-vscode/pull/5154))

## What's new in 1.24.3
* Fix OmniSharp not found issue on Mono ([#5140](https://github.com/OmniSharp/omnisharp-vscode/issues/5140), PR: [#5141](https://github.com/OmniSharp/omnisharp-vscode/pull/5141))

## What's new in 1.24.2
* Support inlay hints ([#1932](https://github.com/OmniSharp/omnisharp-roslyn/issues/1932), PR: [#5107](https://github.com/OmniSharp/omnisharp-vscode/pull/5107))
* Pass "shell: true" as a spawn option when launching O# (PR: [#5125](https://github.com/OmniSharp/omnisharp-vscode/pull/5125))
* Add GoToTypeDefinition provider ([#4251](https://github.com/OmniSharp/omnisharp-vscode/issues/4251), PR: [#5094](https://github.com/OmniSharp/omnisharp-vscode/pull/5094))
* Quote launch paths when necessary ([#5099](https://github.com/OmniSharp/omnisharp-vscode/issues/5099), PR: [#5101](https://github.com/OmniSharp/omnisharp-vscode/pull/5101))
* Fix string escape for linux and unix (PR: [#5122](https://github.com/OmniSharp/omnisharp-vscode/pull/5122))
* Debounce diagnostic requests ([#5085](https://github.com/OmniSharp/omnisharp-vscode/issues/5085), PR: [#5089](https://github.com/OmniSharp/omnisharp-vscode/pull/5089))
* Add AnalyzeOpenDocumentsOnly (PR: [#5088](https://github.com/OmniSharp/omnisharp-vscode/pull/5088))
* Upgrade OmniSharp to 1.38.2:
    * Add analyze open documents only (PR: [omnisharp-roslyn#2346](https://github.com/OmniSharp/omnisharp-roslyn/pull/2346))
    * Create a new GoToTypeDefinition endpoint ([omnisharp-roslyn#2297](https://github.com/OmniSharp/omnisharp-roslyn/issues/2297), PR: [omnisharp-roslyn#2315](https://github.com/OmniSharp/omnisharp-roslyn/pull/2315))
    * Eliminate more instances of IWorkspaceOptionsProvider (PR: [omnisharp-roslyn#2343](https://github.com/OmniSharp/omnisharp-roslyn/pull/2343))
    * Update Build.md brew cask instructions (PR: [omnisharp-roslyn#2355](https://github.com/OmniSharp/omnisharp-roslyn/pull/2355))
    * Remove not used middleware extension methods and unify adding middleware (PR: [omnisharp-roslyn#2340](https://github.com/OmniSharp/omnisharp-roslyn/pull/2340))
    * Pass --overwrite when pushing build artifacts to azure (PR: [omnisharp-roslyn#2358](https://github.com/OmniSharp/omnisharp-roslyn/pull/2358))
    * Delete System.Configuration.ConfigurationManager from deployed packages ([#5113](https://github.com/OmniSharp/omnisharp-vscode/issues/5113), PR: [omnisharp-roslyn#2359](https://github.com/OmniSharp/omnisharp-roslyn/pull/2359))
    * Support inlay hints (PR: [omnisharp-roslyn#2357](https://github.com/OmniSharp/omnisharp-roslyn/pull/2357))
    * Update build tools to match .NET SDK 6.0.201 ([omnisharp-roslyn#2363](https://github.com/OmniSharp/omnisharp-roslyn/pull/2363))

### Emmet support in Razor files

To enable emmet support, add the following to your settings.json:

```json
"emmet.includeLanguages": {
    "aspnetcorerazor": "html"
}
```

### Supported Operating Systems for Debugging

Currently, the C# debugger officially supports the following operating systems:

* X64 operating systems:
    * Windows 7 SP1 and newer
    * macOS 10.12 (Sierra) and newer
    * Linux: see [.NET Core documentation](https://github.com/dotnet/core/blob/master/release-notes/2.2/2.2-supported-os.md#linux) for the list of supported distributions. Note that other Linux distributions will likely work as well as long as they include glibc and OpenSSL.
* ARM operating systems:
    * Linux is supported as a remote debugging target

### Found a Bug?

To file a new issue to include all the related config information directly from vscode by entering the command pallette with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>
(<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> on macOS) and running `CSharp: Report an issue` command. This will open a browser window with all the necessary information related to the installed extensions, dotnet version, mono version, etc. Enter all the remaining information and hit submit. More information can be found on the [wiki](https://github.com/OmniSharp/omnisharp-vscode/wiki/Reporting-Issues).

Alternatively you could visit https://github.com/OmniSharp/omnisharp-vscode/issues and file a new one.

### Development

First install:

* Node.js (8.11.1 or later)
* Npm (5.6.0 or later)

To **run and develop** do the following:

* Run `npm ci`
* Run `npm run compile`
* Open in Visual Studio Code (`code .`)
* _Optional:_ run `npm run watch`, make code changes
* Press <kbd>F5</kbd> to debug

To **test** do the following: `npm run test` or <kbd>F5</kbd> in VS Code with the "Launch Tests" debug configuration.

### License

Copyright © .NET Foundation, and contributors.

The Microsoft C# extension is subject to [these license terms](RuntimeLicenses/license.txt).
The source code to this extension is available on [https://github.com/OmniSharp/omnisharp-vscode](https://github.com/OmniSharp/omnisharp-vscode) and licensed under the [MIT license](LICENSE.txt).

## Code of Conduct

This project has adopted the code of conduct defined by the [Contributor Covenant](http://contributor-covenant.org/)
to clarify expected behavior in our community.
For more information see the [.NET Foundation Code of Conduct](http://www.dotnetfoundation.org/code-of-conduct).

## Contribution License Agreement

By signing the [CLA](https://cla.dotnetfoundation.org/OmniSharp/omnisharp-roslyn), the community is free to use your contribution to [.NET Foundation](http://www.dotnetfoundation.org) projects.

## .NET Foundation

This project is supported by the [.NET Foundation](http://www.dotnetfoundation.org).
