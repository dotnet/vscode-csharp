# Patch package.json
rf="package.json"
rs="replacer.py"

# TODO: Bump the "version" properly

pattern='"publisher": "ms-dotnettools"'
replacement='"publisher": "blipk"'
python3 "$rs" "$rf" "$pattern" "$replacement"

pattern='"description": "Base language support for C#"'
replacement='"description": "Free/Libre C# support for vscode-compatible editors"'
python3 "$rs" "$rf" "$pattern" "$replacement"

pattern='"author": "Microsoft Corporation"'
replacement='"author": "blipk"'
python3 "$rs" "$rf" "$pattern" "$replacement"

pattern='github\.com/dotnet/vscode-csharp'
replacement='github.com/blipk/vscodium-csharp'
python3 "$rs" "$rf" "$pattern" "$replacement"

pattern='{
      "id": "Debugger",
      "description": "\.NET Core Debugger \(Windows / x64\)",
      "url": "https://vsdebugger\.azureedge\.net/coreclr-debug-2-43-0/coreclr-debug-win7-x64\.zip",
      "installPath": "\.debugger/x86_64",
      "platforms": \[
        "win32"
      \],
      "architectures": \[
        "x86_64",
        "arm64"
      \],
      "installTestPath": "\./\.debugger/x86_64/vsdbg-ui\.exe",
      "integrity": "09B636A0CDDE06B822EE767A2A0637845F313427029E860D25C1271E738E4C9D"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(Windows / ARM64\)",
      "url": "https://vsdebugger\.azureedge\.net/coreclr-debug-2-43-0/coreclr-debug-win10-arm64\.zip",
      "installPath": "\.debugger/arm64",
      "platforms": \[
        "win32"
      \],
      "architectures": \[
        "arm64"
      \],
      "installTestPath": "\./\.debugger/arm64/vsdbg-ui\.exe",
      "integrity": "68AB910A1204FC164A211BF80F55C07227B1D557A4F8A0D0290B598F19B2388C"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(macOS / x64\)",
      "url": "https://vsdebugger\.azureedge\.net/coreclr-debug-2-43-0/coreclr-debug-osx-x64\.zip",
      "installPath": "\.debugger/x86_64",
      "platforms": \[
        "darwin"
      \],
      "architectures": \[
        "x86_64",
        "arm64"
      \],
      "binaries": \[
        "\./vsdbg-ui",
        "\./vsdbg"
      \],
      "installTestPath": "\./\.debugger/x86_64/vsdbg-ui",
      "integrity": "D65C1C28F8EAB504B67C6B05AF86990135E0B2E43041CDB398F849D1F30488A0"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(macOS / arm64\)",
      "url": "https://vsdebugger\.azureedge\.net/coreclr-debug-2-43-0/coreclr-debug-osx-arm64\.zip",
      "installPath": "\.debugger/arm64",
      "platforms": \[
        "darwin"
      \],
      "architectures": \[
        "arm64"
      \],
      "binaries": \[
        "\./vsdbg-ui",
        "\./vsdbg"
      \],
      "installTestPath": "\./\.debugger/arm64/vsdbg-ui",
      "integrity": "127FBE4D4B5CD361B4FFCA3971565F87807510CAC599424F886A74CF6FBDB7E3"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(linux / ARM\)",
      "url": "https://vsdebugger\.azureedge\.net/coreclr-debug-2-43-0/coreclr-debug-linux-arm\.zip",
      "installPath": "\.debugger",
      "platforms": \[
        "linux"
      \],
      "architectures": \[
        "arm"
      \],
      "binaries": \[
        "\./vsdbg-ui",
        "\./vsdbg"
      \],
      "installTestPath": "\./\.debugger/vsdbg-ui",
      "integrity": "FBED7C822402B978B5F6102C1526CD6294842C5ACE014AFF2C510ED980BC8FE7"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(linux / ARM64\)",
      "url": "https://vsdebugger\.azureedge\.net/coreclr-debug-2-43-0/coreclr-debug-linux-arm64\.zip",
      "installPath": "\.debugger",
      "platforms": \[
        "linux"
      \],
      "architectures": \[
        "arm64"
      \],
      "binaries": \[
        "\./vsdbg-ui",
        "\./vsdbg"
      \],
      "installTestPath": "\./\.debugger/vsdbg-ui",
      "integrity": "E5FB62E79BC08C67890933913CBAD1D25FB875DD73C553F73F00ECFC22CDE28B"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(linux musl / x64\)",
      "url": "https://vsdebugger\.azureedge\.net/coreclr-debug-2-43-0/coreclr-debug-linux-musl-x64\.zip",
      "installPath": "\.debugger",
      "platforms": \[
        "linux-musl"
      \],
      "architectures": \[
        "x86_64"
      \],
      "binaries": \[
        "\./vsdbg-ui",
        "\./vsdbg"
      \],
      "installTestPath": "\./\.debugger/vsdbg-ui",
      "integrity": "B4BAF73895504D04584BF7E03BBCED840B2405B6F8F432C2E6E8E2C8CB8F952E"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(linux musl / ARM64\)",
      "url": "https://vsdebugger\.azureedge\.net/coreclr-debug-2-43-0/coreclr-debug-linux-musl-arm64\.zip",
      "installPath": "\.debugger",
      "platforms": \[
        "linux-musl"
      \],
      "architectures": \[
        "arm64"
      \],
      "binaries": \[
        "\./vsdbg-ui",
        "\./vsdbg"
      \],
      "installTestPath": "\./\.debugger/vsdbg-ui",
      "integrity": "1F56B47005E7F29C653F351D2A53038AF7E9E4B27969B30DC6C030B2DB0CF6CB"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(linux / x64\)",
      "url": "https://vsdebugger\.azureedge\.net/coreclr-debug-2-43-0/coreclr-debug-linux-x64\.zip",
      "installPath": "\.debugger",
      "platforms": \[
        "linux"
      \],
      "architectures": \[
        "x86_64"
      \],
      "binaries": \[
        "\./vsdbg-ui",
        "\./vsdbg"
      \],
      "installTestPath": "\./\.debugger/vsdbg-ui",
      "integrity": "D26DDB552DCED21D979174FB4783560AA4F8EE3AFC195EA93B0D1A7EBCFCBA79"
    },'
replacement='{
      "id": "Debugger",
      "description": ".NET Core Debugger (Windows / x64)",
      "url": "https://github.com/Samsung/netcoredbg/releases/download/3.1.0-1031/netcoredbg-win64.zip",
      "installPath": ".debugger",
      "platforms": [
        "win32"
      ],
      "architectures": [
        "x86_64"
      ],
      "installTestPath": ".debugger/netcoredbg/netcoredbg.exe"
    },
    {
      "id": "Debugger",
      "description": ".NET Core Debugger (macOS / x64)",
      "url": "https://github.com/Samsung/netcoredbg/releases/download/3.1.0-1031/netcoredbg-osx-amd64.tar.gz",
      "installPath": ".debugger",
      "platforms": [
        "darwin"
      ],
      "architectures": [
        "x86_64",
        "arm64"
      ],
      "binaries": [
        "./netcoredbg"
      ],
      "installTestPath": ".debugger/netcoredbg/netcoredbg"
    },
    {
      "id": "Debugger",
      "description": ".NET Core Debugger (linux / ARM64)",
      "url": "https://github.com/Samsung/netcoredbg/releases/download/3.1.0-1031/netcoredbg-linux-arm64.tar.gz",
      "installPath": ".debugger",
      "platforms": [
        "linux"
      ],
      "architectures": [
        "arm64"
      ],
      "binaries": [
        "./netcoredbg"
      ],
      "installTestPath": ".debugger/netcoredbg/netcoredbg"
    },
    {
      "id": "Debugger",
      "description": ".NET Core Debugger (linux / x64)",
      "url": "https://github.com/Samsung/netcoredbg/releases/download/3.1.0-1031/netcoredbg-linux-amd64.tar.gz",
      "installPath": ".debugger",
      "platforms": [
        "linux",
        "linux-musl"
      ],
      "architectures": [
        "x86_64"
      ],
      "binaries": [
        "./netcoredbg"
      ],
      "installTestPath": ".debugger/netcoredbg/netcoredbg"
    },
    {
      "id": "Razor",
      "description": "Razor Language Server (Windows / x64)",
      "url": "https://download.visualstudio.microsoft.com/download/pr/f64a0a13-30e9-4525-8ed9-4f18e89a01f2/970b8dd2e4a3b9f3487ef4239de68bcf/razorlanguageserver-win-x64-7.0.0-preview.24266.1.zip",
      "installPath": ".razor",
      "platforms": [
        "win32"
      ],
      "architectures": [
        "x86_64"
      ],
      "integrity": "8D255E5DB63345CAEFB795B93F029C108345D5E234B7D7B86FB54EBDE9B3FC2A"
    },
    {
      "id": "Razor",
      "description": "Razor Language Server (Windows / ARM64)",
      "url": "https://download.visualstudio.microsoft.com/download/pr/f64a0a13-30e9-4525-8ed9-4f18e89a01f2/08ae2e66be350ce2c2017fd7eb03978f/razorlanguageserver-win-arm64-7.0.0-preview.24266.1.zip",
      "installPath": ".razor",
      "platforms": [
        "win32"
      ],
      "architectures": [
        "arm64"
      ],
      "integrity": "E4074218E23D45D4269985A18F1627BDD7426A16DC4539E434FE00F1E6EFE81E"
    },
    {
      "id": "Razor",
      "description": "Razor Language Server (Linux / x64)",
      "url": "https://download.visualstudio.microsoft.com/download/pr/f64a0a13-30e9-4525-8ed9-4f18e89a01f2/041a5e759efa80ba48dac5e2e686d2b1/razorlanguageserver-linux-x64-7.0.0-preview.24266.1.zip",
      "installPath": ".razor",
      "platforms": [
        "linux"
      ],
      "architectures": [
        "x86_64"
      ],
      "binaries": [
        "./rzls"
      ],
      "integrity": "4EF2240CA5EAADB30D0BD3EDF259858925B8EEDBE81F04B5FADA6370DCC4DD64"
    },
    {
      "id": "Razor",
      "description": "Razor Language Server (Linux ARM64)",
      "url": "https://download.visualstudio.microsoft.com/download/pr/f64a0a13-30e9-4525-8ed9-4f18e89a01f2/b23fa3ac36f10300deb05a6f6d705117/razorlanguageserver-linux-arm64-7.0.0-preview.24266.1.zip",
      "installPath": ".razor",
      "platforms": [
        "linux"
      ],
      "architectures": [
        "arm64"
      ],
      "binaries": [
        "./rzls"
      ],
      "integrity": "622D13897AE67A18A2801F2B500BDD929E355847625091C2F5F85C8A74359CBE"
    },
    {
      "id": "Razor",
      "description": "Razor Language Server (Linux musl / x64)",
      "url": "https://download.visualstudio.microsoft.com/download/pr/f64a0a13-30e9-4525-8ed9-4f18e89a01f2/0558e8219fe7cad00352ef194c9721dc/razorlanguageserver-linux-musl-x64-7.0.0-preview.24266.1.zip",
      "installPath": ".razor",
      "platforms": [
        "linux-musl"
      ],
      "architectures": [
        "x86_64"
      ],
      "binaries": [
        "./rzls"
      ],
      "integrity": "61ED517AD29DFB3BDF01852F43AD455698437111B925B872115E3B39174C77AA"
    },
    {
      "id": "Razor",
      "description": "Razor Language Server (Linux musl ARM64)",
      "url": "https://download.visualstudio.microsoft.com/download/pr/f64a0a13-30e9-4525-8ed9-4f18e89a01f2/ef50cb22ece80d50723b2e88dd6cc38c/razorlanguageserver-linux-musl-arm64-7.0.0-preview.24266.1.zip",
      "installPath": ".razor",
      "platforms": [
        "linux-musl"
      ],
      "architectures": [
        "arm64"
      ],
      "binaries": [
        "./rzls"
      ],
      "integrity": "DDC420476CC117857DED9DCDBFB8A387A102E9C19DE57749ADB8351CEF7ACEDD"
    },
    {
      "id": "Razor",
      "description": "Razor Language Server (macOS / x64)",
      "url": "https://download.visualstudio.microsoft.com/download/pr/f64a0a13-30e9-4525-8ed9-4f18e89a01f2/002f2c48425cfc3f4ab2dcdd95c856e6/razorlanguageserver-osx-x64-7.0.0-preview.24266.1.zip",
      "installPath": ".razor",
      "platforms": [
        "darwin"
      ],
      "architectures": [
        "x86_64"
      ],
      "binaries": [
        "./rzls"
      ],
      "integrity": "AB86AD64955373EC9F0EA23FBDDA9D676B895150A5BAF75E1CFC1321B2B6ADBB"
    },
    {
      "id": "Razor",
      "description": "Razor Language Server (macOS ARM64)",
      "url": "https://download.visualstudio.microsoft.com/download/pr/f64a0a13-30e9-4525-8ed9-4f18e89a01f2/71361816a0db3363b7afcc9f667e034b/razorlanguageserver-osx-arm64-7.0.0-preview.24266.1.zip",
      "installPath": ".razor",
      "platforms": [
        "darwin"
      ],
      "architectures": [
        "arm64"
      ],
      "binaries": [
        "./rzls"
      ],
      "integrity": "C30559DD13E3A5799FC596992FA04822A253C7EDB514EBE52E24A318DD0288EE"
    },
    {
      "id": "Razor",
      "description": "Razor Language Server (Platform Agnostic)",
      "url": "https://download.visualstudio.microsoft.com/download/pr/f64a0a13-30e9-4525-8ed9-4f18e89a01f2/2e78857667b37f4c1dc570b45de5c967/razorlanguageserver-platformagnostic-7.0.0-preview.24266.1.zip",
      "installPath": ".razor",
      "platforms": [
        "neutral"
      ],
      "architectures": [
        "neutral"
      ],
      "binaries": [
        "./rzls"
      ],
      "integrity": "EE83F90BC19447192171703BCCCA30CADB6177C9D37CCE61E6042B8662321C80"
    },'
python3 "$rs" "$rf" "$pattern" "$replacement"


pattern='~/vsdbg/vsdbg'
replacement='/usr/bin/netcoredbg'
python3 "$rs" "$rf" "$pattern" "$replacement"