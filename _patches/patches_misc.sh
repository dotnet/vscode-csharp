#!/bin/bash
set -x
set -e

# Patches from here https://github.com/dotnet/vscode-csharp/compare/main...muhammadsammy:free-vscode-csharp:master#diff-0ccaa77cc937eeac924d069abe67a8510757b97f326950c258d0e74a61a461d0R290

# Python regex patching script
rs="_patches/replacer.py"

# Remove/update licences
rm RuntimeLicenses/dependencies/OpenDebugAD7-License.txt || true
yes | /bin/cp -rf _patches/RuntimeLicences-license.txt RuntimeLicenses/license.txt
sed -i "s/Copyright (c) .NET Foundation and Contributors/Copyright (c) Blipk A.D. and Contributors for Current Work and Modifications in This Fork,\nCopyright (c) Muhammad Sammy and Contributors for Current Work and Modifications in Their Fork.\nOriginal Work Copyright (c) .NET Foundation and Contributors/" LICENSE.txt
sed -i '/"header\/header": \[ 2, "block", \[/,/^\s*\]\s*\]\s*$/d' .eslintrc.js

# Patch image
yes | /bin/cp -rf _patches/csharpIcon.png images/csharpIcon.png

# Replace extension name - which is from package.json <publisher>.<name>
EXTENSION_NAME="blipk.csharp"
# Ignore _patches directory and any markdown files
find . -type f ! -path '*/_patches/**' ! -path "*.md" -exec sed -i "s/ms-dotnettools.csharp/$EXTENSION_NAME/g" {} +