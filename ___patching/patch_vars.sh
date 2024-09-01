#!/bin/bash
set -x
set -e

# Python regex patching script
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
export SOURCE_DIR="$SCRIPT_DIR/../"
export PATCHES_DIR="$SCRIPT_DIR/_patches/"
export rs="$SCRIPT_DIR/replacer.py"
export pattern=""
export replacement=""


# extension name recognised by vscode - this is from package.json <publisher>.<name>
export EXTENSION_NAME="blipk.csharp"

