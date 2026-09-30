# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See License.txt in the project root for license information.

import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess


def signing_python(az):
    with Path(az).open() as launcher:
        shebang = launcher.readline().strip()
    if not shebang.startswith("#!"):
        raise RuntimeError(f"Azure CLI launcher has no interpreter: {az}")
    command = shlex.split(shebang[2:])
    if len(command) == 2 and command[0] == "/usr/bin/env":
        python = shutil.which(command[1])
    elif len(command) == 1 and os.path.isabs(command[0]):
        python = command[0]
    else:
        python = None
    if not python or not re.fullmatch(r"python(?:3(?:\.\d+)?)?", Path(python).name):
        raise RuntimeError(f"Unsupported Azure CLI Python launcher: {az}: {shebang}")
    return python


def repair():
    # MicroBuild invokes `az` from PATH, not necessarily the CLI used for its initial login.
    az = shutil.which("az")
    if not az:
        raise RuntimeError("MicroBuild's Azure CLI launcher was not found on PATH")
    python = signing_python(az)
    print(f"Repairing signing dependencies for {az} using {python}", flush=True)

    cryptography = subprocess.check_output(
        [
            python,
            "-c",
            "import importlib.metadata as m, site\n"
            "if not site.ENABLE_USER_SITE:\n"
            "    raise RuntimeError('Signing Python must enable user-site packages')\n"
            "m.version('xsignextension')\n"
            "print(m.version('cryptography'))",
        ],
        text=True,
    ).strip()
    # Do not downgrade (or upgrade) crypto selected by XSign just to accommodate pyOpenSSL.
    subprocess.run(
        [
            python,
            "-m",
            "pip",
            "install",
            "--user",
            "--upgrade",
            "--upgrade-strategy",
            "only-if-needed",
            "pyOpenSSL>=26.2.0,<27",
            f"cryptography=={cryptography}",
        ],
        check=True,
    )
    # A fresh process must import the bindings that previously failed with X509_V_FLAG_NOTIFY_POLICY.
    subprocess.run(
        [
            python,
            "-c",
            "import OpenSSL, OpenSSL.crypto, OpenSSL.SSL, cryptography, azure.cli.core; "
            "print('pyOpenSSL:', OpenSSL.__version__, OpenSSL.__file__); "
            "print('cryptography:', cryptography.__version__, cryptography.__file__)",
        ],
        check=True,
    )
    # Load the installed CLI extension without logging in again or submitting a signing request.
    subprocess.run([az, "xsign", "--help"], check=True)


if __name__ == "__main__":
    repair()
