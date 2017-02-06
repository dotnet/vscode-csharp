/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const fs = require('fs');
const path = require('path');
const del = require('del');
const gulp = require('gulp');
const mocha = require('gulp-mocha');
const tslint = require('gulp-tslint');
const vsce = require('vsce');
const debugUtil = require('./out/src/coreclr-debug/util');
const debugInstall = require('./out/src/coreclr-debug/install');
const packages = require('./out/src/packages');
const logger = require('./out/src/logger');
const platform = require('./out/src/platform');
const util = require('./out/src/common');
const child_process = require('child_process');
const optionsSchemaGenerator = require('./out/src/tools/GenerateOptionsSchema');

const Logger = logger.Logger;
const PackageManager = packages.PackageManager;
const LinuxDistribution = platform.LinuxDistribution;
const PlatformInformation = platform.PlatformInformation;

function cleanSync(deleteVsix) {
    del.sync('install.*');
    del.sync('.omnisharp-*');
    del.sync('.debugger');

    if (deleteVsix) {
        del.sync('*.vsix');
    }
}

gulp.task('clean', () => {
    cleanSync(true);
});

gulp.task('generateOptionsSchema', () => {
    optionsSchemaGenerator.GenerateOptionsSchema();
});

// Install Tasks
function install(platformInfo, packageJSON) {
    const packageManager = new PackageManager(platformInfo, packageJSON);
    const logger = new Logger(message => process.stdout.write(message));
    const debuggerUtil = new debugUtil.CoreClrDebugUtil(path.resolve('.'), logger);
    const debugInstaller = new debugInstall.DebugInstaller(debuggerUtil);

    return packageManager.DownloadPackages(logger)
        .then(() => {
            return packageManager.InstallPackages(logger);
        })
        .then(() => {
            return util.touchInstallFile(util.InstallFileType.Lock)
        })
        .then(() => {
            return debugInstaller.finishInstall();
        });
}

gulp.task('install', ['clean'], () => {
    util.setExtensionPath(__dirname);

    return PlatformInformation.GetCurrent()
        .then(platformInfo => {
            return install(platformInfo, getPackageJSON());
        });
});

/// Packaging (VSIX) Tasks
function doPackageSync(packageName) {

    var vsceArgs = [];
    vsceArgs.push(path.join(__dirname, 'node_modules', 'vsce', 'out', 'vsce'))
    vsceArgs.push('package'); // package command

    if (packageName !== undefined) {
        vsceArgs.push('-o');
        vsceArgs.push(packageName);
    }

    var proc = child_process.spawnSync('node', vsceArgs);
    if (proc.error) {
        console.error(proc.error.toString());
    }
}

function doOfflinePackage(platformInfo, packageName, packageJSON) {
    if (process.platform === 'win32') {
        throw new Error('Do not build offline packages on windows. Runtime executables will not be marked executable in *nix packages.');
    }

    cleanSync(false);
    return install(platformInfo, packageJSON)
        .then(() => {
            doPackageSync(packageName + '-' + platformInfo.runtimeId + '.vsix');
        });
}

function getPackageJSON() {
    return JSON.parse(fs.readFileSync('package.json'));
}

gulp.task('package:clean', () => {
    del.sync('*.vsix');
});

gulp.task('package:online', ['clean'], () => {
    doPackageSync();
});

gulp.task('package:offline', ['clean'], () => {
    util.setExtensionPath(__dirname);

    var packageJSON = getPackageJSON();
    var name = packageJSON.name;
    var version = packageJSON.version;
    var packageName = name + '.' + version;

    var packages = [];
    packages.push(new PlatformInformation('win32', 'x86_64'));
    packages.push(new PlatformInformation('darwin', 'x86_64'));
    packages.push(new PlatformInformation('linux', 'x86_64', new LinuxDistribution('centos', '7')));
    packages.push(new PlatformInformation('linux', 'x86_64', new LinuxDistribution('debian', '8')));
    packages.push(new PlatformInformation('linux', 'x86_64', new LinuxDistribution('fedora', '23')));
    packages.push(new PlatformInformation('linux', 'x86_64', new LinuxDistribution('opensuse', '13.2')));
    packages.push(new PlatformInformation('linux', 'x86_64', new LinuxDistribution('rhel', '7.2')));
    packages.push(new PlatformInformation('linux', 'x86_64', new LinuxDistribution('ubuntu', '14.04')));
    packages.push(new PlatformInformation('linux', 'x86_64', new LinuxDistribution('ubuntu', '16.04')));

    var promise = Promise.resolve();

    packages.forEach(platformInfo => {
        promise = promise
            .then(() => {
                return doOfflinePackage(platformInfo, packageName, packageJSON);
            });
    });

    return promise;
});

/// Misc Tasks
const allTypeScript = [
    'src/**/*.ts',
    '!**/*.d.ts',
    '!**/typings**'
];

const lintReporter = (output, file, options) => {
    //emits: src/helloWorld.c:5:3: warning: implicit declaration of function ‘prinft’
    var relativeBase = file.base.substring(file.cwd.length + 1).replace('\\', '/');
    output.forEach(e => {
        var message = relativeBase + e.name + ':' + (e.startPosition.line + 1) + ':' + (e.startPosition.character + 1) + ': ' + e.failure;
        console.log('[tslint] ' + message);
    });
};

gulp.task('tslint', () => {
    gulp.src(allTypeScript)
        .pipe(tslint({
            rulesDirectory: "node_modules/tslint-microsoft-contrib"
        }))
        .pipe(tslint.report(lintReporter, {
            summarizeFailureOutput: false,
            emitError: false
        }))
});
