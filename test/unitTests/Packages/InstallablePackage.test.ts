/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { InstallablePackage } from "../../../src/packageManager/InstallablePackage";
import { IPackage } from "../../../src/packageManager/IPackage";
import { TmpAsset, CreateTmpDir } from "../../../src/CreateTmpAsset";
import { setExtensionPath } from "../../../src/common";
import * as path from "path";

suite(InstallablePackage.name, () => {
    let tmpDir: TmpAsset;
    let extensionPath: string;
    const description = "description";
    const url = "url";
    const platforms = ["platforms"];
    const architectures = [" architectures"];
    const binaries = ["/binaries"];
    const fallbackUrl = "fallbackUrl";
    const platformId = "platformId";
    const installPath = "/installPath";
    const installTestPath = "/installTestPath";

    setup(async () => {
        tmpDir = await CreateTmpDir(true);
        extensionPath = tmpDir.name;
        setExtensionPath(extensionPath);
    });

    test("Throws error if the install path is not absolute", () => {
        expect(() => new InstallablePackage(description, url, platforms, architectures, binaries, fallbackUrl, platformId, "relativePath", installTestPath)).to.throw();
    });

    test("Throws error if the install test path is not absolute", () => {
        expect(() => new InstallablePackage(description, url, platforms, architectures, binaries, fallbackUrl, platformId, installPath, "relativeTestPath")).to.throw();
    });

    test("Throws error if the install test path is not absolute", () => {
        expect(() => new InstallablePackage(description, url, platforms, architectures, ["relativeBinary1", "relativeBinary2"], fallbackUrl, platformId, installPath, installTestPath)).to.throw();
    });

    suite(InstallablePackage.getInstallablePackages.name, () => {
        const packages = <IPackage[]>[
            {
                description: description,
                url: url,
                platforms: platforms,
                architectures: architectures,
                binaries: ["binary1", "binary2"],
                fallbackUrl: fallbackUrl,
                platformId: platformId,
                installPath: "installPath",
                installTestPath: "installTestPath"
            }
        ];

        test("Description, url, platforms, architectures, fallbackUrl, platformId do not change", () => {
            let installablePackage = InstallablePackage.getInstallablePackages(packages);
            for (let i in installablePackage) {
                expect(installablePackage[i].description).to.be.equal(packages[i].description);
                expect(installablePackage[i].url).to.be.equal(packages[i].url);
                expect(installablePackage[i].platforms).to.be.equal(packages[i].platforms);
                expect(installablePackage[i].platformId).to.be.equal(packages[i].platformId);
                expect(installablePackage[i].architectures).to.be.equal(packages[i].architectures);
                expect(installablePackage[i].fallbackUrl).to.be.equal(packages[i].fallbackUrl);
            }
        });

        test("installPath is resolved with the extension path", () => {
            let installablePackage = InstallablePackage.getInstallablePackages(packages);
            for (let i in installablePackage) {
                expect(installablePackage[i].installPath).to.equal(path.join(extensionPath, packages[i].installPath));
            }
        });

        test("installTestPath is resolved with the extension path", () => {
            let installablePackage = InstallablePackage.getInstallablePackages(packages);
            for (let i in installablePackage) {
                expect(installablePackage[i].installTestPath).to.equal(path.join(extensionPath, packages[i].installTestPath));
            }
        });

        test("binaries are resolved with the install path and the extension path", () => {
            let installablePackage = InstallablePackage.getInstallablePackages(packages);
            for (let i in installablePackage) {
                for (let j in installablePackage[i].binaries) {
                    expect(installablePackage[i].binaries[j]).to.equal(path.join(extensionPath, packages[i].installPath, packages[i].binaries[j]));
                }
            }
        });
    });

    teardown(() => {
        if (tmpDir) {
            tmpDir.dispose(); 
        }
        extensionPath = undefined;
    });
});