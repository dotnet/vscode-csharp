# Blazor WebAssembly Browser Debug Control

## Summary

Expose the project path directly on the existing `blazorwasm` debug configuration so callers can launch browser and WebAssembly debugging for an already-running app without composing low-level debug adapter configurations. Also allow `blazorwasm` launch configurations to start only the app process by disabling browser launch.

The motivating integration is the Aspire browser launch command described in [Aspire Extension: Browser and WASM debug session support](https://github.com/microsoft/aspire/issues/17797). Aspire can receive a browser launch request for an already-running app and needs VS Code to start browser JavaScript debugging plus Blazor WebAssembly managed debugging. The Aspire extension should be able to invoke the existing high-level `blazorwasm` debug type instead of composing js-debug, `monovsdbg_wasm`, VSDbg bridge ports, and cascade termination behavior itself.

## Current Behavior

The existing `BlazorDebugConfigurationProvider` owns the detailed Blazor orchestration:

- launch the app for `request: "launch"`;
- read `launchSettings.json` for `inspectUri` and `applicationUrl`;
- launch Edge or Chrome through js-debug;
- optionally start the VSDbg WebAssembly bridge for supported .NET 9+ projects;
- track sibling sessions so terminating one Blazor session terminates the rest.

Today `launchBrowser` calls `useVSDbg` with a value derived from `cwd`. That is incorrect for callers such as Aspire, where the browser launch command can provide the `.csproj` path independently from the web root or working directory. Target framework detection should use a project path, not the launch working directory.

## Proposed Schema

Add `projectPath` to `blazorwasm` attach configurations:

```jsonc
{
  "name": "C#: Launch Blazor Browser Only",
  "type": "blazorwasm",
  "request": "attach",
  "projectPath": "${workspaceFolder}/Client/Client.csproj",
  "url": "https://localhost:5001",
  "browser": "edge"
}
```

The existing request semantics already cover the key modes:

- `request: "launch"`: start the app and browser/WASM debugging by default.
- `request: "attach"`: start browser/WASM debugging only against an already-running app.

For app-only scenarios, callers can use `request: "launch"` with browser launch disabled:

```jsonc
{
  "name": "C#: Launch both app and browser",
  "type": "blazorwasm",
  "request": "launch",
  "projectPath": "${workspaceFolder}/Client/Client.csproj",
  "browser": "edge",
  "launchBrowser": true
}

{
  "name": "C#: Launch Blazor App Only",
  "type": "blazorwasm",
  "request": "launch",
  "projectPath": "${workspaceFolder}/Client/Client.csproj",
  "url": "https://localhost:5001",
  "launchBrowser": false
}

{
  "name": "C#: Attach debugging browser",
  "type": "blazorwasm",
  "request": "attach",
  "projectPath": "${workspaceFolder}/Client/Client.csproj",
  "url": "https://localhost:5001",
  "browser": "edge"
}
```

## Aspire Mapping

Aspire browser launch data should map into the existing `blazorwasm` surface:

- DCP `url` maps to `url`.
- DCP project path maps to `projectPath` when it identifies a `.csproj`.
- DCP `web_root` maps to `webRoot` when it identifies a static web root.
- Browser selection maps to `browser`.
- Browser isolation flags should remain owned by the browser launcher path and should not require Aspire to know C# adapter internals.

## Implementation Notes

`BlazorDebugConfigurationProvider.launchBrowser` should resolve `configuration.projectPath` and pass that value to `useVSDbg`. It may fall back to `cwd` for compatibility with existing launch configurations, but `cwd` should no longer be the primary input for target framework detection.

`useVSDbg` already accepts either a `.csproj` file path or a directory, because `findCsprojFiles` handles both forms. Passing the actual project path fixes .NET 9+ detection for integrations where `cwd` is not the project file or project directory.

`BlazorDebugConfigurationProvider.resolveDebugConfiguration` should skip `launchBrowser` when `configuration.launchBrowser === false`. This keeps the existing launch path but allows callers to use `blazorwasm` for app-only launch when they intentionally do not want browser or WASM debug sessions.
