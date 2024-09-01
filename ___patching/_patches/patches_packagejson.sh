#!/bin/bash
set -x
set -e

# Patch file common variables
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
. "$SCRIPT_DIR/../patch_vars.sh"

# Patch package.json
rf="$SOURCE_DIR/package.json"

# Set version to current date/time
PACKAGE_VERSION=$(date +'%Y-%m-%d_%H-%M')
python "$rs" "$rf" '"version": "((.|\s)*?)"' "\"version\": \"$PACKAGE_VERSION\""

pattern='"license": "SEE LICENSE IN RuntimeLicenses/license.txt",'
replacement='"license": "SEE LICENSE.txt AND RuntimeLicenses/license.txt",'
python "$rs" "$rf" "$pattern" "$replacement"

pattern='"publisher": "ms-dotnettools"'
replacement='"publisher": "blipk"'
python "$rs" "$rf" "$pattern" "$replacement"

pattern='"description": "Base language support for C#"'
replacement='"description": "Base language support for C# with libre NetCoreDbg debugger"'
python "$rs" "$rf" "$pattern" "$replacement"

pattern='"displayName": "C#"'
replacement='"displayName": "C# with NetCoreDbg"'
python "$rs" "$rf" "$pattern" "$replacement"

pattern='"author": "Microsoft Corporation"'
replacement='"author": "blipk"'
python "$rs" "$rf" "$pattern" "$replacement"

pattern='github\.com/dotnet/vscode-csharp'
replacement='github.com/blipk/vscodium-csharp'
python "$rs" "$rf" "$pattern" "$replacement"


# Get the URL of the latest netcoredbg release
initial_url="https://github.com/Samsung/netcoredbg/releases/latest"
final_url=$(curl -Ls -o /dev/null -w "%{url_effective}" "$initial_url")
last_part=$(echo "$final_url" | awk -F/ '{print $NF}')
NETCORE_DBG_RELEASE_BASE="https://github.com/Samsung/netcoredbg/releases/download/$last_part"


#TODO: Might be better to do this with the python json module
pattern='{
      "id": "Debugger",
      "description": "\.NET Core Debugger \(Windows / x64\)",
      "url": "(.*)/coreclr-debug-win7-x64\.zip",
      "installPath": "\.debugger/x86_64",
      "platforms": \[
        "win32"
      \],
      "architectures": \[
        "x86_64",
        "arm64"
      \],
      "installTestPath": "\./\.debugger/x86_64/vsdbg-ui\.exe",
      "integrity": "[A-z0-9]*"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(Windows / ARM64\)",
      "url": "(.*)/coreclr-debug-win10-arm64\.zip",
      "installPath": "\.debugger/arm64",
      "platforms": \[
        "win32"
      \],
      "architectures": \[
        "arm64"
      \],
      "installTestPath": "\./\.debugger/arm64/vsdbg-ui\.exe",
      "integrity": "[A-z0-9]*"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(macOS / x64\)",
      "url": "(.*)/coreclr-debug-osx-x64\.zip",
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
      "integrity": "[A-z0-9]*"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(macOS / arm64\)",
      "url": "(.*)/coreclr-debug-osx-arm64\.zip",
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
      "integrity": "[A-z0-9]*"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(linux / ARM\)",
      "url": "(.*)/coreclr-debug-linux-arm\.zip",
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
      "integrity": "[A-z0-9]*"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(linux / ARM64\)",
      "url": "(.*)/coreclr-debug-linux-arm64\.zip",
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
      "integrity": "[A-z0-9]*"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(linux musl / x64\)",
      "url": "(.*)/coreclr-debug-linux-musl-x64\.zip",
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
      "integrity": "[A-z0-9]*"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(linux musl / ARM64\)",
      "url": "(.*)/coreclr-debug-linux-musl-arm64\.zip",
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
      "integrity": "[A-z0-9]*"
    },
    {
      "id": "Debugger",
      "description": "\.NET Core Debugger \(linux / x64\)",
      "url": "(.*)/coreclr-debug-linux-x64\.zip",
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
      "integrity": "[A-z0-9]*"
    },'
replacement='{
      "id": "Debugger",
      "description": ".NET Core Debugger (Windows / x64)",
      "url": "'"$NETCORE_DBG_RELEASE_BASE"'/netcoredbg-win64.zip",
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
      "url": "'"$NETCORE_DBG_RELEASE_BASE"'/netcoredbg-osx-amd64.tar.gz",
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
      "url": "'"$NETCORE_DBG_RELEASE_BASE"'/netcoredbg-linux-arm64.tar.gz",
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
      "url": "'"$NETCORE_DBG_RELEASE_BASE"'/netcoredbg-linux-amd64.tar.gz",
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
    },'
python "$rs" "$rf" "$pattern" "$replacement"


# shellcheck disable=SC2088
pattern='~/vsdbg/vsdbg'
replacement='/usr/bin/netcoredbg'
python "$rs" "$rf" "$pattern" "$replacement"
