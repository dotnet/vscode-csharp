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
const fs_extra = require('fs-extra-promise');
const packages = require('./out/src/packages');
const logger = require('./out/src/omnisharp/logger');
const platform = require('./out/src/platform');
const child_process = require('child_process');

const Logger = logger.Logger;
const PackageManager = packages.PackageManager;
const PlatformInformation = platform.PlatformInformation;

/// used in offline packaging run so does not clean .vsix
function clean() {
    cleanDebugger();
    return cleanOmnisharp();
}

gulp.task('clean', ['omnisharp:clean', 'debugger:clean', 'package:clean'], () => {

});

/// Omnisharp Tasks
function installOmnisharp(platform, packageJSON) {
    const packageManager = new PackageManager(platform, packageJSON);
    const logger = new Logger(message => process.stdout.write(message));

    return packageManager.DownloadPackages(logger)
        .then(() => {
            return packageManager.InstallPackages(logger);
        });
}

function cleanOmnisharp() {
    return del('.omnisharp');
}

gulp.task('omnisharp:clean', () => {
    return cleanOmnisharp();
});

gulp.task('omnisharp:install', ['omnisharp:clean'], () => {
    return PlatformInformation.GetCurrent()
        .then(platformInfo => {
            return installOmnisharp(platformInfo, getPackageJSON());
        });
});

/// Debugger Tasks
function getDebugInstaller() {
    return new debugInstall.DebugInstaller(new debugUtil.CoreClrDebugUtil(path.resolve('.')), true);
}

function installDebugger(runtimeId) {
    return getDebugInstaller().install(runtimeId);
}

function cleanDebugger() {
    try {
        getDebugInstaller().clean();
        console.log('Cleaned Succesfully');
    } catch (error) {
        console.error(error);
    }
}

gulp.task('debugger:install', ['debugger:clean'], () => {
    installDebugger(gulp.env.runtimeId)
        .then(() => {
            console.log('Installed Succesfully');
        })
        .catch((error) => {
            console.error(error);
        });
});

gulp.task('debugger:clean', () => {
    cleanDebugger();
});

/// Packaging Tasks
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

function doOfflinePackage(runtimeId, platform, packageName, packageJSON) {
    return clean()
        .then(() => {
            return installDebugger(runtimeId);
        })
        .then(() => {
            return installOmnisharp(platform, packageJSON);
        })
        .then(() => {
            doPackageSync(packageName + '-' + runtimeId + '.vsix');
        });
}

function getPackageJSON() {
    return JSON.parse(fs.readFileSync('package.json'));
}

gulp.task('package:clean', () => {
    return del('*.vsix');
});

gulp.task('package:online', ['clean'], () => {
    doPackageSync();
});

gulp.task('package:offline', ['clean'], () => {
    var packageJSON = getPackageJSON();
    var name = packageJSON.name;
    var version = packageJSON.version;
    var packageName = name + '.' + version;

    var packages = [];
    packages.push({ rid: 'win7-x64', platform: new PlatformInformation('win32') });
    packages.push({ rid: 'osx.10.11-x64', platform: new PlatformInformation('darwin', 'x86_64') });
    packages.push({ rid: 'centos.7-x64', platform: new PlatformInformation('linux', 'x86_64') });
    packages.push({ rid: 'debian.8-x64', platform: new PlatformInformation('linux', 'x86_64') });
    packages.push({ rid: 'fedora.23-x64', platform: new PlatformInformation('linux', 'x86_64') });
    packages.push({ rid: 'opensuse.13.2-x64', platform: new PlatformInformation('linux', 'x86_64') });
    packages.push({ rid: 'rhel.7.2-x64', platform: new PlatformInformation('linux', 'x86_64') });
    packages.push({ rid: 'ubuntu.14.04-x64', platform: new PlatformInformation('linux', 'x86_64') });
    packages.push({ rid: 'ubuntu.16.04-x64', platform: new PlatformInformation('linux', 'x86_64') });

    var promise = Promise.resolve();

    packages.forEach(data => {
        promise = promise
            .then(() => {
                return doOfflinePackage(data.rid, data.platform, packageName, packageJSON);
            });
    });

    return promise;
});

/// Test Task
gulp.task('test', () => {
    gulp.src('out/test/**/*.tests.js')
        .pipe(mocha({ ui: "tdd" }))
        .once('error', () => {
            process.exit(1);
        })
        .once('end', () => {
            process.exit();
        });
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