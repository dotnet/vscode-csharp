/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const del = require('del');
const gulp = require('gulp');
const tslint = require('gulp-tslint');
const vsce = require('vsce');
//const omnisharpDownload = require('./out/omnisharpDownload');

gulp.task('omnisharp:clean', () => {
	return del('.omnisharp');
});

//TODO: decouple omnisharpDownload (specifically proxy.ts) from vscode 
// gulp.task('omnisharp:fetch', ['omnisharp:clean'], () => {
// 	return omnisharpDownload.downloadOmnisharp();
// });

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

// gulp.task('omnisharp', ['omnisharp:fetch']);

gulp.task('package', () => {
    vsce(['', '', 'package']);
});