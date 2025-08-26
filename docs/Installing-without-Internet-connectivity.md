Some environments may not have access to the Internet and thus the marketplace to download extensions or dependencies dynamically.  To install the C# language extension and dependencies without Internet access, the following is required:

> NOTE: It is important that if extensions offer platform-specific versions, that you ensure you are downloading/installing the matching platform pieces. Failure to do so could put your VS Code environment in a non-functional state.

* Download and install the required .NET 9.0.1 runtime from https://dot.net/downloads
* Download the following VS Code extensions **for your specific platform**:
  * [.NET Install Tool](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.vscode-dotnet-runtime)
  * [C# language extension](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csharp)
  * Optional extensions such as the [C# Dev Kit](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csdevkit), [MAUI](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.dotnet-maui), or [IntelliCode for C#](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.vscodeintellicode-csharp)
* Follow the documentation to [**Install from VSIX**](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix) in VS Code with the downloaded extension files