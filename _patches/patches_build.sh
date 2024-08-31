#!/bin/bash
set -x
set -e

# Python regex patching script
rs="_patches/replacer.py"

# Update readme
yes | /bin/cp -rf _patches/README.md README.md


# Don't use .npmrc in build process
rm .npmrc || true


echo "$FILE applied successfully."
