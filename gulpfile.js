/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const fs = require('fs');
const path = require('path');
const del = require('del');
const gulp = require('gulp');
const gulpUtil = require('gulp-util');
const tslint = require('gulp-tslint');
const vsce = require('vsce');
const debugUtil = require('./out/coreclr-debug/util.js');
const debugInstall = require('./out/coreclr-debug/install.js');
const fs_extra = require('fs-extra-promise');
const omnisharpDownload = require('./out/omnisharpDownload');
const child_process = require('child_process');

const OmniSharpVersion = omnisharpDownload.OmniSharpVersion;

/// used in offline packaging run so does not clean .vsix
function clean() {
    cleanDebugger();
    return cleanOmnisharp();
}

gulp.task('clean', ['omnisharp:clean',  'debugger:clean', 'package:clean'], () => {

});

/// Omnisharp Tasks
function installOmnisharp(omnisharpAssetName) {
    const logFunction = (message) => { console.log(message); };
    return omnisharpDownload.downloadOmnisharp(logFunction, omnisharpAssetName);
}

function cleanOmnisharp() {
    return del('.omnisharp');
}

gulp.task('omnisharp:clean', () => {
    return cleanOmnisharp();
});
 
gulp.task('omnisharp:install', ['omnisharp:clean'], () => {
    var asset = gulpUtil.env.asset || omnisharpDownload.getOmnisharpAssetName();
    return installOmnisharp(asset);
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
    installDebugger(gulp.env.runtimeId).then(() => {
        console.log('Installed Succesfully');
    }).catch((error) => {
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

function doOfflinePackage(runtimeId, omnisharpAsset, packageName) {
    return clean().then(() => {
        return installDebugger(runtimeId);
    }).then(() => {
        return installOmnisharp(omnisharpAsset);
    }).then(() => {
        doPackageSync(packageName + '-' + runtimeId + '.vsix');
    });
}

gulp.task('package:clean', () => {
    return del('*.vsix');
});

gulp.task('package:online', ['clean'], () => {
    doPackageSync();
});

gulp.task('package:offline', ['clean'], () => {
    var json = JSON.parse(fs.readFileSync('package.json'));
    var name = json.name;
    var version = json.version;
    var packageName = name + '.' + version;

    var packages = [];
    packages.push({rid: 'win7-x64', omni: `omnisharp-${OmniSharpVersion}-win-x64-net451.zip`});
    packages.push({rid: 'osx.10.11-x64', omni: `omnisharp-${OmniSharpVersion}-osx-x64-netcoreapp1.0.tar.gz`});
    packages.push({rid: 'centos.7-x64', omni: `omnisharp-${OmniSharpVersion}-centos-x64-netcoreapp1.0.tar.gz`});
    packages.push({rid: 'debian.8-x64', omni: `omnisharp-${OmniSharpVersion}-debian-x64-netcoreapp1.0.tar.gz`});
    packages.push({rid: 'rhel.7.2-x64', omni: `omnisharp-${OmniSharpVersion}-rhel-x64-netcoreapp1.0.tar.gz`});
    packages.push({rid: 'ubuntu.14.04-x64', omni: `omnisharp-${OmniSharpVersion}-ubuntu-x64-netcoreapp1.0.tar.gz`});

    var promise = Promise.resolve();

    packages.forEach(pair => {
        promise = promise.then(() => {
            return doOfflinePackage(pair.rid, pair.omni, packageName);
        })
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