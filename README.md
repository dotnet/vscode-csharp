## C# for Visual Studio Code

C# is the feature-rich, language support for C# in VS Code. This extension is being updated to be powered by a new fully open-source Language Server Protocol (LSP) Host.  To use the LSP-powered version, click on the “Switch to Pre-Release Version” or “Install Pre-Release” button above. To use the OmniSharp-powered version, click “Install Release Version” or continuing using the 1.x version you already have installed.

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

## What's new in 1.26.0
* Update OmniSharp to 1.39.7 (PR: [#5840](https://github.com/OmniSharp/omnisharp-vscode/pull/5840))
  * Respond to breaking change in VSCode 1.79.2 in completion (PR:[#2542](https://github.com/OmniSharp/omnisharp-roslyn/pull/2542))
  * Use dotnet-cake for build (PR:[#2537](https://github.com/OmniSharp/omnisharp-roslyn/pull/2537))
  * Implement LSP CodeAction resolve (PR:[#2467](https://github.com/OmniSharp/omnisharp-roslyn/pull/2467))
* Update debugger to 1.25.8 (PR: [#5706](https://github.com/OmniSharp/omnisharp-vscode/pull/5706))
* Updates to README, default branch and repo link (PR: [#5709](https://github.com/OmniSharp/omnisharp-vscode/pull/5709))

## What's new in 1.25.9
* Readme updates (PR: [#5705](https://github.com/OmniSharp/omnisharp-vscode/pull/5705))

## What's new in 1.25.8
* Update Razor to 7.0.0-preview.23258.1 (PR: [#5672](https://github.com/OmniSharp/omnisharp-vscode/pull/5672))
  * Fix issue with Razor attribute hover and Go to Definition (PR: [#8653](https://github.com/dotnet/razor/pull/8653))
  * Fix issue with Razor formatting (PR: [#8669](https://github.com/dotnet/razor/pull/8669))
* Combine test compile step into normal compile (PR: [#5666](https://github.com/OmniSharp/omnisharp-vscode/pull/5666))

## What's new in 1.25.7
* Update Razor to 7.0.0-preview.23224.3 (PR: [#5660](https://github.com/OmniSharp/omnisharp-vscode/pull/5660))
  * Fix issue with Razor diagnostics (PR: [#8622](https://github.com/dotnet/razor/pull/8622))

## What's new in 1.25.6
* Update Razor to 7.0.0-preview.23213.4 (PR: [#5655](https://github.com/OmniSharp/omnisharp-vscode/pull/5655))
  * Fix serialization issue with project.razor.json files (PR: [#8489](https://github.com/dotnet/razor/pull/8489))

## What's new in 1.25.5
* Update Razor to 7.0.0-preview.23124.2 (PR: [#5604](https://github.com/OmniSharp/omnisharp-vscode/pull/5604))
  * Fix colorization when nullable operators are present ([#5570](https://github.com/OmniSharp/omnisharp-vscode/pull/5570))
  * Add C#/HTML folding range support ([razor#8309](https://github.com/dotnet/razor/pull/8309))
  * Formatting fixes ([razor#8318](https://github.com/dotnet/razor/pull/8318))
* Update OmniSharp to 1.39.6 (PR: [#5625](https://github.com/OmniSharp/omnisharp-vscode/pull/5625))
  * Use new VS threading version to match with Razor (PR:[#2518](https://github.com/OmniSharp/omnisharp-roslyn/pull/2518))
* Update OmniSharp to 1.39.5 (PR: [#5618](https://github.com/OmniSharp/omnisharp-vscode/pull/5618))
  * Update to Roslyn `4.6.0-3.23153.5` (PR:[#2511](https://github.com/OmniSharp/omnisharp-roslyn/pull/2511))
  * Report to the client if the project being loaded is sdk style (PR:[#2502](https://github.com/OmniSharp/omnisharp-roslyn/pull/2502))
* Automatically trust ASP.NET Core HTTPS development certificate (PR: [#5589](https://github.com/OmniSharp/omnisharp-vscode/pull/5589))
* Improve outline to be less verbose (PR: [#5536](https://github.com/OmniSharp/omnisharp-vscode/pull/5536))
* Update Razor TextMate grammar (PR: [#5570](https://github.com/OmniSharp/omnisharp-vscode/pull/5570))

## What's new in 1.25.4
* Update OmniSharp to 1.39.4 (PR: [#5544](https://github.com/OmniSharp/omnisharp-vscode/pull/5544))
  * Disable snippets in sync completion (PR: [#2497](https://github.com/OmniSharp/omnisharp-roslyn/pull/2497))

## What's new in 1.25.3
* Update Razor to 7.0.0-preview.23067.5 (PR: [#5543](https://github.com/OmniSharp/omnisharp-vscode/pull/5543))
  * Enables support for arm64
  * Adds document color and color presentation features
* Update Roslyn to 4.5.0-2.22527.10 (PR: [#2486](https://github.com/OmniSharp/omnisharp-roslyn/pull/2486))
* Update dotnet-script dependencies to 1.4.0 (PR: [#2477](https://github.com/OmniSharp/omnisharp-roslyn/pull/2477))
* Register the LanguageServerLogger only once (PR: [#2473](https://github.com/OmniSharp/omnisharp-roslyn/pull/2473))
* Fix extension not finding mono. ([#5454](https://github.com/OmniSharp/omnisharp-vscode/issues/5454), PR: [#5484](https://github.com/OmniSharp/omnisharp-vscode/pull/5484))
* Update debugger to 1.25.3. ([#5460](https://github.com/OmniSharp/omnisharp-vscode/issues/5460), PR: [#5489](https://github.com/OmniSharp/omnisharp-vscode/pull/5489))
* Fix missing fix all commands. ([#5474](https://github.com/OmniSharp/omnisharp-vscode/issues/5474), PR: [#5475](https://github.com/OmniSharp/omnisharp-vscode/pull/5475))
* Fix failure to parse sdk version and sdk path. ([#2412](https://github.com/OmniSharp/omnisharp-vscode/issues/2412), PR: [#5459](https://github.com/OmniSharp/omnisharp-vscode/pull/5459))
* Handle custom OmniSharp launch paths. ([#5449](https://github.com/OmniSharp/omnisharp-vscode/issues/5449), PR: [#5456](https://github.com/OmniSharp/omnisharp-vscode/pull/5456))

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
