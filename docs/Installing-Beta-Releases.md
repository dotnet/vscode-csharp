A new release of the C# extension is generally shipped every month or so. During development, interim beta releases are made available as VSIXs here: https://github.com/OmniSharp/omnisharp-vscode/releases. If you wish to install a beta release, please follow these steps:

#### Uninstalling a previously-installed C# extension

When installing a beta release, it's a good idea to remove any previous versions of the extension. You can do this like so:

1. Open Visual Studio Code and select View->Extensions from the menu to display the Extensions pane.
2. In the Extensions pane, locate the C# extension and click the little 'gear' icon next to it. From the drop-down menu, select 'Uninstall'.

   ![Uninstall C# Extension](images/uninstall-csharp-extension.png)

3. Visual Studio Code will ask if you are sure that you want to uninstall the extension. Click "OK" on this prompt.
4. In the Extensions pane, a button will appear next to the C# extension that reads, "Reload". Click this to cause Visual Studio Code to reload without the C# extension installed. Visual Studio Code will ask you whether you are certain whether you wish to reload. Click "OK" to confirm.

#### Installing a beta release of the C# extension

First, find the release that you wish to install at https://github.com/OmniSharp/omnisharp-vscode/releases. Each release will contain several `.vsix` files -- one for each supported platform. Download the `.vsix` that matches the platform you want to install:

File (where 1.2.3 should be replaced with the real version number) | OS | Processor
--|--|--
csharp-1.2.3-darwin-arm64.vsix | macOS | ARM-based
csharp-1.2.3-darwin-x64.vsix | macOS | Intel-based
csharp-1.2.3-linux-x64.vsix | Linux | x86_64
csharp-1.2.3-win32-arm64.vsix | Windows | ARM64
csharp-1.2.3-win32-x64.vsix | Windows | x64
csharp-1.2.3-win32-ia32.vsix | Windows | x86 (32-bit only)

Download the `.vsix` to your machine. Use the following steps to install the `.vsix` into Visual Studio Code.

1. Open Visual Studio Code and select View->Extensions from the menu to display the Extensions pane.
2. Click the `...` at the top-right corner of the Extensions pane and select "Install from VSIX..." on the menu that appears.

   ![Install from VSIX](images/install-from-vsix.png)

3. Locate the `.vsix` file you download and click "Open".
4. Visual Studio Code will prompt you to restart to enable the extension. Click "Restart" to confirm.

#### Cleanup steps

Eventually an official version of the C# extension will be released with the same version number as the beta. Be sure to uninstall your beta release at that time and reinstall the official version.