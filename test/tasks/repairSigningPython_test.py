# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See License.txt in the project root for license information.

import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "repairSigningPython", ROOT / "tasks/signing/repairSigningPython.py"
)
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)


class SigningPythonTests(unittest.TestCase):
    def launcher(self, text):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        az = Path(directory.name) / "az"
        az.write_text(text)
        return str(az)

    def test_uses_absolute_launcher_interpreter_not_bootstrap_python(self):
        az = self.launcher("#!/usr/bin/python3\n")
        self.assertEqual(repair.signing_python(az), "/usr/bin/python3")

    def test_resolves_env_interpreter_from_same_path_as_az(self):
        az = self.launcher("#!/usr/bin/env python3\n")
        with patch.object(repair.shutil, "which", return_value="/custom/bin/python3.10"):
            self.assertEqual(repair.signing_python(az), "/custom/bin/python3.10")

    def test_rejects_unknown_launchers_without_guessing_an_interpreter(self):
        for shebang in ["#!/bin/bash", "#!/usr/bin/env -S python3", "not a shebang"]:
            with self.subTest(shebang=shebang):
                with self.assertRaises(RuntimeError):
                    repair.signing_python(self.launcher(shebang + "\n"))

    def test_rejects_missing_env_interpreter(self):
        with patch.object(repair.shutil, "which", return_value=None):
            with self.assertRaises(RuntimeError):
                repair.signing_python(self.launcher("#!/usr/bin/env python3\n"))

    def test_requires_az_on_path(self):
        with patch.object(repair.shutil, "which", return_value=None):
            with self.assertRaises(RuntimeError):
                repair.repair()

    def test_repairs_user_site_and_preserves_installed_cryptography(self):
        az = self.launcher("#!/usr/bin/python3\n")
        with (
            patch.object(repair.shutil, "which", return_value=az),
            patch.object(repair.subprocess, "check_output", return_value="48.0.1\n") as probe,
            patch.object(repair.subprocess, "run") as run,
        ):
            repair.repair()
        self.assertEqual(probe.call_args.args[0][:2], ["/usr/bin/python3", "-c"])
        self.assertIn("site.ENABLE_USER_SITE", probe.call_args.args[0][2])
        self.assertIn("m.version('xsignextension')", probe.call_args.args[0][2])
        self.assertEqual(
            run.call_args_list[0].args[0],
            [
                "/usr/bin/python3", "-m", "pip", "install", "--user", "--upgrade",
                "--upgrade-strategy", "only-if-needed", "pyOpenSSL>=26.2.0,<27",
                "cryptography==48.0.1",
            ],
        )
        self.assertIn("OpenSSL.crypto, OpenSSL.SSL", run.call_args_list[1].args[0][2])
        self.assertIn("azure.cli.core", run.call_args_list[1].args[0][2])
        self.assertEqual(run.call_args_list[2].args[0], [az, "xsign", "--help"])
        self.assertTrue(all(call.kwargs["check"] for call in run.call_args_list))

    def test_probe_failure_stops_before_install(self):
        az = self.launcher("#!/usr/bin/python3\n")
        with (
            patch.object(repair.shutil, "which", return_value=az),
            patch.object(
                repair.subprocess, "check_output",
                side_effect=subprocess.CalledProcessError(1, "probe"),
            ),
            patch.object(repair.subprocess, "run") as run,
        ):
            with self.assertRaises(subprocess.CalledProcessError):
                repair.repair()
        run.assert_not_called()

    def test_install_and_import_failures_are_not_swallowed(self):
        az = self.launcher("#!/usr/bin/python3\n")
        for index in range(3):
            with self.subTest(failed_command=index):
                with (
                    patch.object(repair.shutil, "which", return_value=az),
                    patch.object(repair.subprocess, "check_output", return_value="48.0.1\n"),
                    patch.object(
                        repair.subprocess, "run",
                        side_effect=[None] * index + [subprocess.CalledProcessError(1, "check")],
                    ) as run,
                ):
                    with self.assertRaises(subprocess.CalledProcessError):
                        repair.repair()
                self.assertEqual(run.call_count, index + 1)


if __name__ == "__main__":
    unittest.main()
