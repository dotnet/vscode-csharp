# free-omnisharp-vscode

C# extension for vscode-compatible editors.

## Why?
The debugger included in the official C# extension is [proprietary](https://aka.ms/VSCode-DotNet-DbgLicense) and is licensed to only work with Microsoft versions of vscode.
This extension replaces it with [Samsung's MIT-licensed alternative](https://github.com/Samsung/netcoredbg/blob/master/LICENSE).

## Installation:
This extension is published at [open-vsx.org](https://open-vsx.org/extension/muhammad-sammy/csharp).

### Build from source:
Requirements:
- [nodejs](https://nodejs.org)
- [vsce](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#vsce)

```
git clone https://github.com/muhammadsammy/free-omnisharp-vscode.git

cd free-omnisharp-vscode

npm install

npm run compile

vsce package
```
then run `Extensions: Install from VSIX` from the command pallete and select the `csharp-VERSION_NUMBER.vsix` file.

<br />

# From [OmniSharp/omnisharp-vscode](https://github.com/OmniSharp/omnisharp-vscode) README:

## Note about using .NET 5 SDKs
The .NET 5 SDK requires version 16.8 of MSBuild.

For Windows users who have Visual Studio installed, this means you will need to be on the latest Visual Studio 16.8 Preview.
For MacOS and Linux users who have Mono installed, this means you will need to be on the latest stable Mono (6.12.0).

## What's new in 1.23.4
-   Use incremental changes to update language server (PR: [#4088](https://github.com/OmniSharp/omnisharp-vscode/pull/4088))
-   Set meaning of UseGlobalMono "auto" to "always" now that Mono 6.12.0 ships with MSBuild 16.8 (PR: [#4115](https://github.com/OmniSharp/omnisharp-vscode/pull/4115))
-   Updated OmniSharp to 1.37.3
    -   Fixed a bug when the server wouldn't start on MacOS/Linux when a username contained a space (PR: [omnisharp-roslyn/#1979](https://github.com/OmniSharp/omnisharp-roslyn/pull/1979))
    -   Update to Mono 6.12.0 (PR: [omnisharp-roslyn/#1981](https://github.com/OmniSharp/omnisharp-roslyn/pull/1981))
    -   Fix responsiveness regression with targeted DiagnosticWorker revert ([omnisharp-roslyn/#1982](https://github.com/OmniSharp/omnisharp-roslyn/issues/1982), [omnisharp-roslyn/#1983](https://github.com/OmniSharp/omnisharp-roslyn/issues/1983), PR: [omnisharp-roslyn/#1984](https://github.com/OmniSharp/omnisharp-roslyn/pull/1984))

## What's new in 1.23.3
-   Fix ps call for Alpine images ([#4023](https://github.com/OmniSharp/omnisharp-vscode/issues/4023), PR: [#4097](https://github.com/OmniSharp/omnisharp-vscode/pull/4097))
-   Support TextEdit in completion responses (PR: [@4073](https://github.com/OmniSharp/omnisharp-vscode/pull/4073))
-   Updated Razor support
    -   Updated OmniSharp version (should improve stability) [dotnet/aspnetcore-tooling#20320](https://github.com/dotnet/aspnetcore/issues/20320)
    -   Corrected positioning for `@using` for components added by light bulb. [dotnet/aspnetcore-tooling#25019](https://github.com/dotnet/aspnetcore/issues/25019)
    -   Mixed HTML & C# Razor formatting support ([dotnet/aspnetcore-tooling#25470](https://github.com/dotnet/aspnetcore/issues/25470)) / ([dotnet/aspnetcore-tooling#14271](https://github.com/dotnet/aspnetcore/issues/14271))
    -   Add using for C# Type light bulb ([dotnet/aspnetcore-tooling#18173](https://github.com/dotnet/aspnetcore/issues/18173))
    -   Fully qualify C# Type light bulb ([dotnet/aspnetcore-tooling#24778](https://github.com/dotnet/aspnetcore/issues/24778))
    -   Added support for engine logging on .NET process for Blazor WASM apps ([OmniSharp/omnisharp-vscode#4070](https://github.com/OmniSharp/omnisharp-vscode/issues/4070))
    -   Fixed bug in clean-up of Blazor WASM debugging session ([OmniSharp/omnisharp-vscode#4056](https://github.com/OmniSharp/omnisharp-vscode/issues/4056))
-   Debugger Features:
    -   Add support for Function Breakpoints ([#295](https://github.com/OmniSharp/omnisharp-vscode/issues/295))
-   Debugger Fixes:
    -   [Debugger licensing errors are not reported to the UI ([#3759](https://github.com/OmniSharp/omnisharp-vscode/issues/3759))
    -   [Error processing 'variables' request. Unknown Error: 0x8000211d ([#3926](https://github.com/OmniSharp/omnisharp-vscode/issues/3926))
    -   [Method with a function pointer local breaks variables view and debug console ([#4052](https://github.com/OmniSharp/omnisharp-vscode/issues/4052))
-   Update to OmniSharp 1.37.2 (PR: [#4107](https://github.com/OmniSharp/omnisharp-vscode/pull/4107))
    -   Updated MSBuild, MSBuild resolvers and Roslyn to match .NET Core 5.0 RC2 and VS 16.8 Preview 4. (PR: [omnisharp-roslyn/#1971](https://github.com/OmniSharp/omnisharp-roslyn/pull/1971), PR: [omnisharp-roslyn/#1974](https://github.com/OmniSharp/omnisharp-roslyn/pull/1974))
    -   Decouple FixAll from the workspace ([omnisharp-roslyn/#1960](https://github.com/OmniSharp/omnisharp-roslyn/issues/1960), PR: [omnisharp-roslyn/#1962](https://github.com/OmniSharp/omnisharp-roslyn/pull/1962))
    -   Added binding redirects for Microsoft.CodeAnalysis.Features and Microsoft.CodeAnalysis.CSharp.Features (PR: [omnisharp-roslyn/#1964](https://github.com/OmniSharp/omnisharp-roslyn/pull/1964))
    -   Always log error responses with error level (PR: [omnisharp-roslyn/#1963](https://github.com/OmniSharp/omnisharp-roslyn/pull/1963))
    -   Added support for override property completion. **Warning**: contains breaking change, as `InsertText` was removed from the response, please use `TextEdit` instead (PR: [omnisharp-roslyn/#1957](https://github.com/OmniSharp/omnisharp-roslyn/pull/1957))
    -   Correctly handle <ProjectReferences> that don't produce references (PR: [omnisharp-roslyn/#1956](https://github.com/OmniSharp/omnisharp-roslyn/pull/1956))
    -   Marked `/autocomplete` endpoint as obsolete - the clients should be switching to `/completion` and `/completion/resolve` (PR: [omnisharp-roslyn/#1951](https://github.com/OmniSharp/omnisharp-roslyn/pull/1951))
    -   Fixed escapes in regex completions ([omnisharp-roslyn/#1949](https://github.com/OmniSharp/omnisharp-roslyn/issues/1949), PR: [omnisharp-roslyn/#1950](https://github.com/OmniSharp/omnisharp-roslyn/pull/1950))
    -   Fixed completion on part of existing string ([omnisharp-vscode#4063](https://github.com/OmniSharp/omnisharp-vscode/issues/4063), PR: [omnisharp-roslyn/#1941](https://github.com/OmniSharp/omnisharp-roslyn/pull/1941))
    -   Fixed LSP completion item kinds (PR: [omnisharp-roslyn/#1940](https://github.com/OmniSharp/omnisharp-roslyn/pull/1940))
    -   Added support for textDocument/implementation in LSP mode (PR: [omnisharp-roslyn/#1970](https://github.com/OmniSharp/omnisharp-roslyn/pull/1970))
    -   Fixed namespace icon in completion response ([omnisharp-vscode#4051](https://github.com/OmniSharp/omnisharp-vscode/issues/4051), PR: [omnisharp-roslyn/#1936](https://github.com/OmniSharp/omnisharp-roslyn/pull/1936))
    -   Improved performance of find implementations (PR: [omnisharp-roslyn/#1935](https://github.com/OmniSharp/omnisharp-roslyn/pull/1935))
    -   Add support for new quick info endpoint when working with Cake (PR: [omnisharp-roslyn/#1945](https://github.com/OmniSharp/omnisharp-roslyn/pull/1945))
    -   Add support for new completion endpoints when working with Cake ([omnisharp-roslyn/#1939](https://github.com/OmniSharp/omnisharp-roslyn/issues/1939), PR: [omnisharp-roslyn/#1944](https://github.com/OmniSharp/omnisharp-roslyn/pull/1944))
    -   When an analyzer fails to load, log an error (PR: [omnisharp-roslyn/#1972](https://github.com/OmniSharp/omnisharp-roslyn/pull/1972))
    -   Added support for 'extract base class' (PR: [omnisharp-roslyn/#1969](https://github.com/OmniSharp/omnisharp-roslyn/pull/1969))
    -   OmniSharp.Path can only be set in user settings (PR: [omnisharp-roslyn/#1946](https://github.com/OmniSharp/omnisharp-roslyn/pull/1946))
    -   Add support for code actions besides ApplyChangesOperation's (PR: [omnisharp-roslyn/#1724](https://github.com/OmniSharp/omnisharp-roslyn/pull/1724))

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
