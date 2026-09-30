# C# LSP .NET plugin for GitHub Copilot

The C# extension automatically installs the [official .NET `dotnet` plugin](https://github.com/dotnet/skills/tree/main/plugins/dotnet) when a compatible GitHub Copilot CLI or GitHub Copilot App is installed.

## Why it is installed

The plugin provides .NET development skills and a C# language-server declaration for GitHub Copilot. These help Copilot work with .NET projects and use C# language intelligence.

The plugin's C# language server requires the **.NET 10 SDK** and `dotnet` on PATH. Installing the plugin does not install that SDK or start the language server. Start a new Copilot session, or restart an existing one, to load the plugin.

## Disable automatic installation and uninstall

Set `dotnet.copilotDotnetPlugin.enableAutoInstall` to `false` and restart the C# extension. This prevents future automatic installation but does not remove an already-installed plugin.

To uninstall, make sure all GitHub Copilot and VS Code instances are closed, then:
1.  For the Copilot CLI, run `copilot plugin uninstall dotnet@dotnet-agent-skills`
2.  For the GitHub Copilot App, go to `Customize`, select the `Plugins` tab and right-click to uninstall the `dotnet` plugin from `dotnet-agent-skills`

## Install manually

Register the `dotnet-agent-skills` marketplace once, then install the plugin:

```text
copilot plugin marketplace add dotnet/skills
copilot plugin install dotnet@dotnet-agent-skills
```

## Troubleshooting

Open **View > Output** and select **C#**. Discovery, inventory, and installation failures are logged without affecting normal C# features. Each installation operation has an overall two-minute timeout.

If installation is skipped, make sure the Copilot CLI is available on PATH on the extension host. For the GitHub Copilot app, use the app once so its CLI can be extracted, then restart VS Code. An incompatible CLI listing format, unavailable Git/network access, permissions, or organization policy can prevent installation.
