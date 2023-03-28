## C# for VIsual Studio Code
C# is an extension that contributes to the larger [C# Dev Kit extension]() for Visual Studio Code to provide performant and reliable language support. Under the hood, this extension is powered by a Language Server Protocol (LSP) Tools Host which integrates with open source components like Roslyn (Link to Roslyn) and Razor (link to Razor) to provide rich type information and a faster, more reliable C# experience.


C# is the default language support for [C# Dev Kit]() and is shipped as part of that extension as a required dependency.


## Recommended Install
While it is possible to use the C# extension as a standalone extension, we highly recommend using the [C# Dev Kit extension]().

Installing [C# Dev Kit]() will automatically install this extension as a required dependency
* If working on a solution that requires versions prior to .NET 6, install a Full Framework runtime and MSBuild tooling.
  * Set omnisharp.useModernNet to false and dotnet.server.useOmnisharp to true
  * Windows: .NET Framework along with MSBuild Tools 
  * MacOS/Linux: Mono with MSBuild 

## Features
  * Refactoring
  * Code Navigation (GTD, FAR)
  * Code Completions
  * Roslyn powered semantic awareness

## How to use Omnisharp?
If you don’t want to take advantage of the great Language Server features, you can revert back to using Omnisharp by going to the Extension settings and setting `dotnet.server.useOmnisharp` to true. This will require that you restart VS Code to take effect.


## Found a Bug?
To file a new issue to include all the related config information directly from vscode by entering the command pallette with Ctrl+Shift+P (Cmd+Shift+P on macOS) and running CSharp: Report an issue command. This will open a browser window with all the necessary information related to the installed extensions, dotnet version, mono version, etc. Enter all the remaining information and hit submit. More information can be found on the wiki .
Alternatively you could visit https://github.com/dotnet/vscode-csharp/issues  and file a new one.


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

By signing the [CLA](https://cla.dotnetfoundation.org/OmniSharp/omnisharp-roslyn), the community is free to use your contribution to [.NET Foundation](http://www.dotnetfoundation.org) projects.

### .NET Foundation

This project is supported by the [.NET Foundation](http://www.dotnetfoundation.org).

## Feedback

[FAQs]
Check out the FAQs before filing a question.

[Provide feedback]
File questions, issues, or feature requests for the extension.

[Known issues]
If someone has already filed an issue that encompasses your feedback, please leave a 👍 or 👎 reaction on the issue to upvote or downvote it to help us prioritize the issue.

[Quick survey](https://www.research.net/r/8KGJ9V8?o=[o_value]&v=[v_value]&m=[m_value])
Let us know what you think of the extension by taking the quick survey.