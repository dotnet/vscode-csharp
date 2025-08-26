## About this page

This page provides instructions on debugging into the .NET Runtime and likely any other Open-Source .NET Libraries provided by Microsoft that your application is using. The end of this page also provides instructions for debugging into other external libraries from nuget.org.

## C# Debugger settings in VS Code

In VS Code, C# debugger options can be configured as a VS Code setting (File->Preferences->Setting) or, if you have a launch.json file, as properties of your active launch configuration in your launch.json file. This page will explain how to set these settings through launch.json, but they are also configurable as a setting. For more information see the [official documentation for debugger settings](https://code.visualstudio.com/docs/csharp/debugger-settings).

If you are not currently debugging using a launch.json file, but would like to in order to follow along with this tutorial, you can generate a launch.json by running ".NET: Generate Assets for build and debug" from the VS Code command pallet.

### Enable debugging into the .NET Runtime

In order to debug into the .NET Runtime, you need to configure the following settings --

```json
    "justMyCode": false,
    "symbolOptions": {
        "searchMicrosoftSymbolServer": true
    },
    "suppressJITOptimizations": true,
    "env": {
        "COMPlus_ReadyToRun": "0"
    }
```

**Note:** if you already have an `env` property in your launch.json, move the `COMPlus_*` environment variables to that block rather than creating a second `env` property.

When you start debugging, symbols should now download from the internet, and if you stop in .NET Runtime code, or click on a stack frame, the debugger should automatically download sources.

After you have debugged and downloaded all the symbols you need, comment out the `"searchMicrosoftSymbolServer": true` so that the debugger doesn't always go to the internet and search for symbols for any dlls which don't have symbols on the Microsoft symbol server.

### Explanation about what the options are doing

> `"justMyCode": false,`

Just My Code is a feature that makes it easier to find problems in your code by ignoring code that is optimized or you don't have symbols for. See [here](https://code.visualstudio.com/docs/csharp/debugger-settings#_just-my-code) for a full explanation.

> `"searchMicrosoftSymbolServer": true`

This adds the Microsoft Symbol Server (`https://msdl.microsoft.com/download/symbols`) to the end of the symbol search path. So if a module loads, and the debugger cannot find symbols for it any of the other places, it will then search the Microsoft Symbol Server.

> `"suppressJITOptimizations": true`

This option disables optimizations when .NET assemblies load. See [here](https://code.visualstudio.com/docs/csharp/debugger-settings#_suppress-jit-optimizations) for a full explanation.

> `"COMPlus_ReadyToRun": "0"`

This environment variables tells the .NET Runtime that it should ignore the ahead-of-time compiled native code that is in many .NET Runtime assemblies, and it should instead compile these assemblies to native code just-in-time. This is important because `"suppressJITOptimizations": true` doesn't affect assemblies that have already been compiled to native code. So the two options work together to make it so that the .NET Runtime runs without optimizations.

## Debugging into other open-source nuget packages

If you would like to debug into other open-source nuget packages, such as Newtonsoft.Json, you can also enable `searchNuGetOrgSymbolServer`. Example:

```jsonc
    "justMyCode": false,
    "symbolOptions": {
        "searchNuGetOrgSymbolServer": true,
        "searchMicrosoftSymbolServer": true
    },
    "suppressJITOptimizations": true,
    // NOTE: Remove unless debugging into the .NET Runtime
    "env": {
        "COMPlus_ReadyToRun": "0"
    }
```

A few notes:
1. Not every library on nuget.org will have their .pdb files indexed. If you find that the debugger cannot find a pdb file for an open-source library you are using, please encourage the open-source library to upload their PDBs ([see here for instructions](https://docs.microsoft.com/en-us/nuget/create-packages/symbol-packages-snupkg)).
2. Most libraries on nuget.org are **not** ahead-of-time compiled, so if you are only trying to debug into this library and not the .NET Runtime itself, you can likely omit the `env` section from above. Using an optimized .NET Runtime will significantly improve performance in some cases.
3. Only Microsoft provided libraries will have their .pdb files on the Microsoft symbol server, so you can omit `searchMicrosoftSymbolServer` if you are only interested in an OSS library.
