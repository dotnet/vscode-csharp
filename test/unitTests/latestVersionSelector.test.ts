/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { should } from 'chai';
import { GetLatestInstalledExperimentalVersion } from '../../src/omnisharp/latestVersionSelector';

const tmp = require('tmp');

suite("Experimental Omnisharp - Latest Version", () => {
    suiteSetup(() => should());

    test('Returns latest version', () => {
        let versions: string[] = ["1.28.0", "1.27.0", "1.26.0"];
        let latestVersion = GetLatestVersion(versions);
        latestVersion.should.equal("1.28.0");
    });

    test('Ignores unparseable strings', () => {
        let versions: string[] = ["1.28.0", "1.27.0", "1.26.0", "a.b.c"];
        let latestVersion = GetLatestVersion(versions);
        latestVersion.should.equal("1.28.0");
    });

    test('Returns pre-release versions if they are the latest', () => {
        let versions: string[] = ["1.28.0", "1.27.0", "1.26.0", "1.29.0-beta1"];
        let latestVersion = GetLatestVersion(versions);
        latestVersion.should.equal("1.29.0-beta1");
    });

    test('Returns the latest pre-release version', () => {
        let versions: string[] = ["1.28.0", "1.27.0", "1.29.0-beta2", "1.29.0-beta1"];
        let latestVersion = GetLatestVersion(versions);
        latestVersion.should.equal("1.29.0-beta2");
    });

    test('Returns the prod version over pre-release version', () => {
        let versions: string[] = ["1.28.0", "1.27.0", "1.29.0", "1.29.0-beta1"];
        let latestVersion = GetLatestVersion(versions);
        latestVersion.should.equal("1.29.0");
    });

    test('Returns undefined if no valid version exists', () => {
        let versions: string[] = ["a.b.c"];
        let latestVersion = GetLatestVersion(versions);
        latestVersion.should.equal("");
    });

    test('Returns empty if folder is empty', () => {
        let versions: string[] = [];
        let latestVersion = GetLatestVersion(versions);
        latestVersion.should.equal("");
    });

    test('Returns empty if experimental folder doesnot exist', () => {
        let latestVersion = GetLatestInstalledExperimentalVersion("");
        latestVersion.should.equal("");
    });
});

function GetLatestVersion(versions: string[]): string {
    let tmpDir = tmp.dirSync();
    let dirPath = tmpDir.name;
    AddVersionsToDirectory(dirPath, versions);
    let latestVersion = GetLatestInstalledExperimentalVersion(dirPath);
    CleanUpDirectory(dirPath);
    tmpDir.removeCallback();
    return latestVersion;
}

function AddVersionsToDirectory(dirPath: string, versions: string[]) {
    for (let version of versions) {
        fs.mkdir(`${dirPath}/${version}`, () => { });
    }
}

function CleanUpDirectory(dirPath: string) {
    let installedVersions = fs.readdirSync(dirPath);
    for (let version of installedVersions) {
        fs.rmdirSync(`${dirPath}/${version}`);
    }
}
