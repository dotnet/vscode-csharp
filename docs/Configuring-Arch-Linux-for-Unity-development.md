Install the following packages from `aur`:
- `mono`
- `mono-msbuild`*
- `mono-msbuild-resolver`

These packages will install automatically:
- `dotnet-host`
- `dotnet-runtime`
- `dotnet-sdk`
- `dotnet-targeting-pack`

In Visual Studio Code settings, configure the C# setting `Omnisharp: Use Global Mono` to `always` (or set `"omnisharp.useGlobalMono": "always"` in your settings.json).

\* Note: It may be necessary to downgrade the version of `mono-msbuild` from `16.8` to `16.6`. You can use a package named `downgrade` to do this. Once downgraded, add the `mono-msbuild` package to `IgnorePkg` to prevent it from updating.