# C# LSP .NET plugin for GitHub Copilot

The C# extension automatically installs the [official .NET `dotnet` plugin](https://github.com/dotnet/skills/tree/main/plugins/dotnet) when a compatible GitHub Copilot CLI is available on PATH or a GitHub Copilot app runtime is installed on the machine running the extension.

## Why it is installed

The plugin provides .NET development skills and a C# language-server declaration for GitHub Copilot. These help Copilot work with .NET projects and use C# language intelligence.

The plugin's C# language server requires the **.NET 10 SDK** and `dotnet` on PATH. Installing the plugin does not install that SDK or start the language server. Start a new Copilot session, or restart an existing one, to load the plugin.

## Uninstall and prevent automatic reinstallation

Open the Command Palette and run:

**.NET: Uninstall Copilot C# LSP plugin**

This command uninstalls the `dotnet` plugin if it exists and opts out of automatic installation.

You can also remove the plugin directly from a terminal:

```text
copilot plugin uninstall dotnet
```

For a marketplace installation, use:

```text
copilot plugin uninstall dotnet@dotnet-agent-skills
```

To use the plugin again, install it manually with the installation command below.
```text
copilot plugin install dotnet/skills:plugins/dotnet
```

## Troubleshooting

Open **View > Output** and select **C#**. Discovery, inventory, installation, and removal failures are logged without affecting normal C# features. Each install or uninstall operation has an overall two-minute timeout.

If installation is skipped, make sure the Copilot CLI is available on PATH on the extension host. For the GitHub Copilot app, use the app once so its CLI can be extracted, then restart VS Code. An incompatible CLI listing format, unavailable Git/network access, permissions, or organization policy can prevent installation.
