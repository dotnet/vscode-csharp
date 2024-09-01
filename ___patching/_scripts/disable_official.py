#!/usr/bin/env python

"""
This disables the official C# extension `ms-dotnettools.csharp`
And removes it as a dependency for any other extensions that rely on it.

This allows those extensions to be used with this fork.

To undo the dependency changes, pass anything as an additional argument.
To re-enable the official extension you will have to reinstall it.
"""

import os
import sys
import json
import shutil


def update_extension_dependencies(
    file_path,
    remove_extension_ids: list[str] | None = None,
    add_extension_ids: list[str] | None = None,
):
    """
    Remove and/or add extensionDependencies in a vscode extensions package.json
    """

    remove_extension_ids = remove_extension_ids or []
    add_extension_ids = add_extension_ids or []

    if not remove_extension_ids and not add_extension_ids:
        print("No extension ids provided to remove nor add")
        return

    try:
        with open(file_path, "r") as file:
            data = json.load(file)
    except FileNotFoundError:
        print(f"Could not find {file_path}")
        return

    deps_removed = []
    deps_added = []
    if "extensionDependencies" in data:
        for remove_extension_id in remove_extension_ids:
            if remove_extension_id in data["extensionDependencies"]:
                data["extensionDependencies"].remove(remove_extension_id)
                deps_removed.append(remove_extension_id)

                for add_extension_id in add_extension_ids:
                    data["extensionDependencies"].append(add_extension_id)
                    deps_added.append(add_extension_id)

    if deps_removed or deps_added:
        print(
            f"Updated `extensionDependencies` in {file_path}\n    - removed: {deps_removed}\n    + added:   {deps_added}"
        )

    with open(file_path, "w") as file:
        json.dump(data, file, indent=4)


def update_extension_compatibility(extensions_file_path, undo=False):
    try:
        with open(extensions_file_path, "r") as file:
            extensions_file = json.load(file)
    except FileNotFoundError:
        print(f"Could not find {extensions_file_path}")
        return

    remove_ids = ["blipk.csharp", "ms-dotnettools.csharp"]
    # add_ids = ["blipk.csharp"]
    add_ids = []

    if undo:
        remove_ids, add_ids = add_ids, remove_ids

    for extension in extensions_file:
        print(f"Checking extension `{extension['identifier']['id']}`")
        extension_package_file = os.path.join(
            extension["location"]["path"], "package.json"
        )
        update_extension_dependencies(extension_package_file, remove_ids, add_ids)


def disable_extension(extensions_file_path, extension_id, delete=False):
    try:
        with open(extensions_file_path, "r") as file:
            extensions_file = json.load(file)
    except FileNotFoundError:
        print(f"Could not find {extensions_file_path}")
        return

    deleted = []
    for index, extension in enumerate(extensions_file):
        if extension["identifier"]["id"] == extension_id:
            deleted.append(index)

        if delete:
            shutil.rmtree(extension["location"]["path"])

    for index in deleted:
        del extensions_file[index]

    if deleted:
        with open(extensions_file_path, "w") as file:
            json.dump(extensions_file, file, indent=4)
        print(f"Removed `{extension_id}` from {extensions_file_path}")
    else:
        print(f"Could not find `{extension_id}` in {extensions_file_path}")


def main(undo=False):
    extensions_dir = os.path.expanduser("~/.vscode-oss/extensions/")
    extensions_file_path = os.path.join(extensions_dir, "extensions.json")

    update_extension_compatibility(extensions_file_path, undo)
    disable_extension(extensions_file_path, "ms-dotnettools.csharp")


if __name__ == "__main__":
    undo = False
    if len(sys.argv) > 1:
        undo = True
    main(undo)
