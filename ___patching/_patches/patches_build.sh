#!/bin/bash
set -x
set -e

# Patch file common variables
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
. "$SCRIPT_DIR/../patch_vars.sh"

# Update readme
# shellcheck disable=SC2216
yes | /bin/cp -rf "$PATCHES_DIR/README.md" "$SOURCE_DIR"/README.md


# Don't use .npmrc in build process
rm "$SOURCE_DIR"/.npmrc || true

