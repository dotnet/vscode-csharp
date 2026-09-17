# C# LSP .NET plugin for GitHub Copilot

The C# extension automatically installs the [.NET team's `dotnet` plugin](https://github.com/dotnet/skills/tree/main/plugins/dotnet) when a compatible GitHub Copilot CLI or GitHub Copilot app runtime is available on the machine running the extension.

## Why it is installed

The plugin provides .NET development skills and a C# language-server declaration for GitHub Copilot. These help Copilot work with .NET projects and use C# language intelligence. Only the base `dotnet` plugin is installed, not the other plugins in the `dotnet/skills` repository.

The plugin's C# language server requires the **.NET 10 SDK** and `dotnet` on PATH. Installing the plugin does not install that SDK or start the language server. Start a new Copilot session, or restart an existing one, to load the plugin.

This is separate from the C# extension's own language server and from VS Code Chat plugins.

## How installation works

Installation runs in the background and does not delay C# extension startup or language-server initialization. The extension uses:

```text
copilot plugin install dotnet/skills:plugins/dotnet
```

The extension prefers an available standalone CLI, otherwise it looks for the installed GitHub app's extracted CLI. It does not install Copilot or launch the app. If the app has never extracted its CLI, installation is skipped; a later VS Code launch can try again after the app has been used.

App discovery supports standard Windows installation folders, macOS Applications folders, and Linux packaged or extracted app layouts. Nonstandard app locations and opaque Linux AppImages may not be discoverable; a standalone Copilot CLI on PATH can be used in those cases.

Copilot controls where plugins are installed. The subprocess inherits the extension host's environment, including `COPILOT_HOME`; the normal default is the user's `.copilot` directory. The app and standalone CLI share the plugin when they use the same configuration directory. A configuration override used only by an already-running app is not inherited by a subprocess started by VS Code.

In Remote SSH, WSL, and dev-container workspaces, only Copilot on the **extension host** is considered. The extension does not install into a separate local desktop host.

Existing installations, including disabled plugins, are left unchanged. The extension does not update or re-enable them, and it leaves conflicting same-name plugins alone. Automatic installation is skipped in untrusted workspaces and when the existing VS Code `chat.disableAIFeatures` setting is enabled.

Installed and conflicting-plugin results are cached privately for the current C# extension version to avoid repeated CLI launches. An extension version change invalidates the cache. External plugin removal, enablement changes, or resolution of a conflict might therefore not be noticed until the next extension update. Unavailable runtimes and failures are not cached.

## Uninstall and prevent automatic reinstallation

Open the Command Palette and run:

**.NET: Uninstall Copilot C# LSP plugin**

This command records a private opt-out in VS Code's extension state, then checks the current CLI inventory and uninstalls the plugin. It always bypasses the automatic-install cache. The opt-out persists across C# extension updates and is not synced to other machines.

If removal fails or Copilot is unavailable, the opt-out remains in effect as long as it was saved successfully. The command reports any failure; see the **C#** output channel for details.

You can also remove the plugin directly from a terminal:

```text
copilot plugin uninstall dotnet
```

For a marketplace installation, use:

```text
copilot plugin uninstall dotnet@dotnet-agent-skills
```

**Removing it only through Copilot CLI does not opt out of the C# extension's automatic installation.** Use the extension's uninstall command to prevent reinstallation, even if the plugin has already been removed.

To use the plugin again, install it manually with the installation command above. This does not clear the extension's automatic-install opt-out. There is no additional public C# setting for this feature.

## Troubleshooting

Open **View > Output** and select **C#**. Discovery, inventory, installation, and removal failures are logged without affecting normal C# features. Each install or uninstall operation has an overall two-minute timeout.

If installation is skipped, make sure Copilot is installed on the extension host. For the GitHub app, use the app once so its CLI can be extracted, then restart VS Code. An incompatible CLI listing format, unavailable Git/network access, permissions, or organization policy can prevent installation. The extension does not change credentials, install missing prerequisites, or bypass policy.

Installation status, cached status, skips, failures, and manual uninstall outcomes are reported through the extension's existing telemetry mechanism, subject to VS Code telemetry controls. These events do not include CLI output, file paths, configuration contents, or credentials.
