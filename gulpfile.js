/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const decompress = require('gulp-decompress');
const del = require('del');
const fs = require('fs-extra-promise');
const gulp = require('gulp');
const path = require('path');
const tslint = require('gulp-tslint');
const omnisharpInstall = require('./out/omnisharpInstall');

gulp.task('omnisharp:clean', () => {
	return del('bin');
});

gulp.task('omnisharp:fetch', ['omnisharp:clean'], () => {
	return omnisharpInstall.downloadOmnisharp('v1.6.7.9')
		.pipe(decompress({strip: 1}))
		.pipe(gulp.dest('bin'));
});

const allTypeScript = [
    'src/**/*.ts',
    '!**/*.d.ts',
    '!**/typings**'
];

const lintReporter = (output, file, options) => {
	//emits: src/helloWorld.c:5:3: warning: implicit declaration of function ‘prinft’
	var relativeBase = file.base.substring(file.cwd.length + 1).replace('\\', '/');
	output.forEach(function(e) {
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

gulp.task('omnisharp:fixscripts', ['omnisharp:fetch'], () => {

	var _fixes = Object.create(null);
	_fixes['./bin/omnisharp.cmd'] = '@"%~dp0packages\\dnx-clr-win-x86.1.0.0-beta4\\bin\\dnx.exe" "%~dp0packages\\OmniSharp\\1.0.0\\root" run %*';
	_fixes['./bin/omnisharp'] = '#!/bin/bash\n'
+ 'SOURCE="${BASH_SOURCE[0]}"\n'
+ 'while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink\n'
+ 'DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"\n'
+ 'SOURCE="$(readlink "$SOURCE")"\n'
+ '[[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located\n'
+ 'done\n'
+ 'DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"\n'
+ 'export SET DNX_APPBASE="$DIR/packages/OmniSharp/1.0.0/root"\n'
+ 'export PATH=/usr/local/bin:/Library/Frameworks/Mono.framework/Commands:$PATH # this is required for the users of the Homebrew Mono package\n'
+ 'exec "$DIR/packages/dnx-mono.1.0.0-beta4/bin/dnx" "$DNX_APPBASE" run "$@"\n'
+ '\n';

	const promises = Object.keys(_fixes).map(key => {
		return new Promise((resolve, reject) => {
			fs.writeFile(path.join(__dirname, key), _fixes[key], err => {
				if (err) {
					reject(err);
				}
                else {
					resolve();
				}
			});
		});
	});

	return Promise.all(promises)
});

gulp.task('omnisharp', ['omnisharp:fixscripts']);