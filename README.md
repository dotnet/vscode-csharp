# free-omnisharp-vscode
VS Code's C# extension but without the debugger.

## Why?
The debugger included in the official C# extension is [proprietary](https://aka.ms/VSCode-DotNet-DbgLicense) and is licensed to only work with Microsoft versions of vscode.

## Note about using .NET Core 3.1.401 or .NET 5 Preview 8 SDKs on Mono platforms

Because of the new minimum MSBuild version requirement of these new SDKs, it will be necessary to use the Mono packaged with the C# extension. The meaning of "omnisharp.useGlobalMono" has change to "never", this forces the use of the included Mono. To use your system
install of Mono set the value to "always" although it may not be compatible with newer SDKs.

## What's new in 1.23.2
-   Ensure that all quickinfo sections have linebreaks between them, and don't add unecessary duplicate linebreaks (PR: [omnisharp-roslyn#1900](https://github.com/OmniSharp/omnisharp-roslyn/pull/1900))
-   Support completion of unimported types (PR: [omnisharp-roslyn#1896](https://github.com/OmniSharp/omnisharp-roslyn/pull/1896))
-   Exclude Misc project from InternalsVisibleTo completion (PR: [omnisharp-roslyn#1902](https://github.com/OmniSharp/omnisharp-roslyn/pull/1902))
-   Ensure unimported things are sorted after imported things (PR: [omnisharp-roslyn#1903](https://github.com/OmniSharp/omnisharp-roslyn/pull/1903))
-   Correctly handle multiple reference aliases (PR: [omnisharp-roslyn#1905](https://github.com/OmniSharp/omnisharp-roslyn/pull/1905))
-   Better handle completion when the display text is not in the final result (PR: [omnisharp-roslyn#1908](https://github.com/OmniSharp/omnisharp-roslyn/pull/1908))
-   Correctly mark hover markup content as markdown ([omnisharp-roslyn#1906](https://github.com/OmniSharp/omnisharp-roslyn/issues/1906), PR: [omnisharp-roslyn#1909](https://github.com/OmniSharp/omnisharp-roslyn/pull/1909))
-   Upgrade lsp ([omnisharp-roslyn#1898](https://github.com/OmniSharp/omnisharp-roslyn/issues/1898), PR: [omnisharp-roslyn#1911](https://github.com/OmniSharp/omnisharp-roslyn/pull/1911))
-   Updated to ILSpy 6.1.0.5902 (PR: [omnisharp-roslyn#1913](https://github.com/OmniSharp/omnisharp-roslyn/pull/1913))
-   Updated to NET 5.0 preview8 (PR: [omnisharp-roslyn#1916](https://github.com/OmniSharp/omnisharp-roslyn/pull/1916))
-   Add HTTP Driver back to build.json (PR: [omnisharp-roslyn#1918](https://github.com/OmniSharp/omnisharp-roslyn/pull/1918))
-   Updated the docs to mention .NET 4.7.2 targeting pack (PR: [omnisharp-roslyn#1922](https://github.com/OmniSharp/omnisharp-roslyn/pull/1922))
-   Support for configurations remapping in solution files ([omnisharp-roslyn#1828](https://github.com/OmniSharp/omnisharp-roslyn/issues/1828), PR: [omnisharp-roslyn#1835](https://github.com/OmniSharp/omnisharp-roslyn/pull/1835))
-   Only run dotnet --info once for the working directory (PR: [omnisharp-roslyn#1925](https://github.com/OmniSharp/omnisharp-roslyn/pull/1925))
-   Update build tool versions for NET 5 RC1 (PR: [omnisharp-roslyn#1926](https://github.com/OmniSharp/omnisharp-roslyn/pull/1926))
-   Update Roslyn to 3.8.0-3.20451.2 (PR: [omnisharp-roslyn#1927](https://github.com/OmniSharp/omnisharp-roslyn/pull/1927))
-   Clean up Blazor WebAssembly notifications (PR: [#4018](https://github.com/OmniSharp/omnisharp-vscode/pull/4018))
-   Remove proposed api attribute (PR: [#4029](https://github.com/OmniSharp/omnisharp-vscode/pull/4029))
-   New completion service including override and unimported type completion (`omnisharp.enableImportCompletion`) (PR: [#3986](https://github.com/OmniSharp/omnisharp-vscode/pull/3986))

## Build and Install:

**Requirements:**
- [nodejs](https://nodejs.org)
- [vsce](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#vsce)

```
git clone https://github.com/muhammadsammy/free-omnisharp-vscode.git

cd free-omnisharp-vscode

npm install

vsce package
```
then run `Extensions: Install from VSIX` from the command pallete and select the `csharp-VERSION_NUMBER.vsix` file.

**alternatively** you can download the vsix file from github releases or from [open-vsx.org](https://open-vsx.org/extension/muhammad-sammy/csharp)
