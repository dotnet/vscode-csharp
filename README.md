## C# for Visual Studio Code
A [Visual Studio Code](https://code.visualstudio.com/) [extension](https://marketplace.visualstudio.com/VSCode) that provides rich language support for C# and is shipped along with [C# Dev Kit][csdevkitextension]. Powered by a Language Server Protocol (LSP) server, this extension integrates with open source components like [Roslyn](https://github.com/dotnet/roslyn) and [Razor](https://github.com/dotnet/razor) to provide rich type information and a faster, more reliable C# experience.

## Recommended Install
While it is possible to use the C# extension as a standalone extension, we highly recommend using [C# Dev Kit][csdevkitextension].

1. Installing [C# Dev Kit][csdevkitextension] will automatically install this extension as a required dependency.
2. Open a folder/workspace that contains a C# project (.csproj) and a C# solution (.sln) and the extension will activate.
3. Whether you install C# Dev Kit or just the C# extension, the [.NET Runtime Installer Tool extension](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.vscode-dotnet-runtime) will be installed as a dependency.

Note: If working on a solution that requires versions prior to .NET 6 or non-solution based projects, install a .NET Framework runtime and [MSBuild tooling](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022).
  * Set omnisharp.useModernNet to false and set dotnet.server.useOmnisharp to true
  * Uninstall or disable C# Dev Kit
  * Windows: .NET Framework along with [MSBuild Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
  * MacOS/Linux: [Mono with MSBuild](https://www.mono-project.com/download/preview/)

## Features
Learn more about the rich features of the C# extension:
  * [Refactoring](https://code.visualstudio.com/docs/csharp/refactoring): Edit your code with code fixes and refactorings
  * [Navigation](https://code.visualstudio.com/docs/csharp/navigate-edit): Explore and navigate your code with features like Go To Definition and Find All References
  * [IntelliSense](https://code.visualstudio.com/docs/csharp/navigate-edit): Write code with auto-completion
  * [Formatting and Linting](https://code.visualstudio.com/docs/csharp/formatting-linting): Format and lint your code

For more information you can:

- [Follow our C# tutorial](https://code.visualstudio.com/docs/csharp/get-started) with step-by-step instructions for building a simple app.
- Check out the [C# documentation](https://code.visualstudio.com/docs/languages/csharp) on the VS Code site for general information about using the extension.

## How to use OmniSharp?
If you don’t want to take advantage of the great Language Server features, you can revert back to using OmniSharp by going to the Extension settings and setting `dotnet.server.useOmnisharp` to true. Next, uninstall or disable C# Dev Kit. Finally, restart VS Code for this to take effect.

## Found a Bug?
To file a new issue:

1. Go to Settings (UI) and search for "trace" in the search bar.
2. Under "Dotnet > Server: Trace" select "Trace" from the drop down. This will provide more output information.
3. Reload the window by opening the Command Palette with Ctrl+Shift+P (Cmd+Shift+P on macOS), type "Reload Window", and press Enter.
4. Next, check the C# logs in the Output Window by opening it with Ctrl+Shift+U (Cmd+Shift+U on macOS), and select C# from the dropdown.
5. Select and copy all the text in the log, and then report the issue through VS Code.
6. Open the Command Palette with Ctrl+Shift+P (Cmd+Shift+P on macOS), type “CSharp: Report an issue”, and press Enter.
7. This will open a window with all the necessary information related to the C# extension, dotnet version, mono version, etc.
8. Paste the previously copied C# log into the “Steps to Reproduce” field. Please also include a description of what you were doing/attempting to do at the time the problem occurred.
9. Click the “Preview on GitHub” button, and then file the issue.

Alternatively, you could visit https://github.com/dotnet/vscode-csharp/issues and file a new issue there.

## Contributing

### License

Copyright © .NET Foundation, and contributors.

The Microsoft C# extension is subject to [these license terms](RuntimeLicenses/license.txt).
The source code to this extension is available on [https://github.com/dotnet/vscode-csharp](https://github.com/dotnet/vscode-csharp) and licensed under the [MIT license](LICENSE.txt).

### Code of Conduct

This project has adopted the code of conduct defined by the [Contributor Covenant](http://contributor-covenant.org/)
to clarify expected behavior in our community.
For more information see the [.NET Foundation Code of Conduct](http://www.dotnetfoundation.org/code-of-conduct).

### Contribution License Agreement

By signing the [CLA](https://cla.dotnetfoundation.org/), the community is free to use your contribution to [.NET Foundation](http://www.dotnetfoundation.org) projects.

### .NET Foundation

This project is supported by the [.NET Foundation](http://www.dotnetfoundation.org).

## Feedback

<!-- 
[FAQs]
Check out the FAQs before filing a question. 
-->

[Provide feedback](https://github.com/dotnet/vscode-csharp/issues)
File questions, issues, or feature requests for the extension.

[Known issues](https://github.com/dotnet/vscode-csharp/issues)
If someone has already filed an issue that encompasses your feedback, please leave a 👍 or 👎 reaction on the issue to upvote or downvote it to help us prioritize the issue.

[Quick survey](https://www.research.net/r/8KGJ9V8?o=[o_value]&v=[v_value]&m=[m_value])
Let us know what you think of the extension by taking the quick survey.


[csdevkitextension]: https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csdevkit
