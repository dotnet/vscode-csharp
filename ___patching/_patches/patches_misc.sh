#!/bin/bash
set -x
set -e

# Patch file common variables
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
. "$SCRIPT_DIR/../patch_vars.sh"

# Patches from here https://github.com/dotnet/vscode-csharp/compare/main...muhammadsammy:free-vscode-csharp:master#diff-0ccaa77cc937eeac924d069abe67a8510757b97f326950c258d0e74a61a461d0R290


# Remove/update licences
rm RuntimeLicenses/dependencies/OpenDebugAD7-License.txt || true
# shellcheck disable=SC2216
yes | /bin/cp -rf "$PATCHES_DIR"/RuntimeLicences-license.txt "$SOURCE_DIR"/RuntimeLicenses/license.txt
sed -i "s/Copyright (c) .NET Foundation and Contributors/Copyright (c) Blipk A.D. and Contributors for Current Work and Modifications in This Fork,\nCopyright (c) Muhammad Sammy and Contributors for Current Work and Modifications in Their Fork.\nOriginal Work Copyright (c) .NET Foundation and Contributors/" "$SOURCE_DIR"/LICENSE.txt
sed -i '/"header\/header": \[ 2, "block", \[/,/^\s*\]\s*\]\s*$/d' "$SOURCE_DIR"/.eslintrc.js

# Patch image
# shellcheck disable=SC2216
yes | /bin/cp -rf "$PATCHES_DIR"/csharpIcon.png "$SOURCE_DIR"/images/csharpIcon.png

# Replace extension name - which is from package.json <publisher>.<name>
EXTENSION_NAME="blipk.csharp"
# Ignore ___patching directory and any markdown files
find . -type f ! -path '*/___patching/**' ! -path "*.md" -exec sed -i "s/ms-dotnettools.csharp/$EXTENSION_NAME/g" {} +
