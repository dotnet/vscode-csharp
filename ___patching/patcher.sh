#!/bin/bash
set -x
set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
. "$SCRIPT_DIR/patch_vars.sh"

for patch in "$PATCHES_DIR"/*.sh; do
    echo "Applying $patch"
    chmod +x "$patch"
    . "$SCRIPT_DIR/patch_vars.sh"
    # shellcheck disable=SC1090
    . "$patch"
    echo "$patch applied successfully"
done

