/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as gulp from 'gulp';
import * as optionsSchemaGenerator from './src/tools/GenerateOptionsSchema';
import * as packageDependencyUpdater from './src/tools/UpdatePackageDependencies';

import tslint from 'gulp-tslint';

require('./tasks/testTasks');
require('./tasks/onlinePackagingTasks');
require('./tasks/offlinePackagingTasks');
require('./tasks/backcompatTasks');

gulp.task('generateOptionsSchema', () => {
    optionsSchemaGenerator.GenerateOptionsSchema();
});

gulp.task('updatePackageDependencies', () => {
    packageDependencyUpdater.updatePackageDependencies();
});

gulp.task('tslint', () => {
    gulp.src([
        'src/**/*.ts',
        '!**/*.d.ts',
        '!**/typings**'
    ])
        .pipe(tslint({
            program: require('tslint').Linter.createProgram("./tsconfig.json"),
            configuration: "./tslint.json"
        }))
        .pipe(tslint.report({
            summarizeFailureOutput: false,
            emitError: false
        }));
});

const lintReporter = (output, file, options) => {
    //emits: src/helloWorld.c:5:3: warning: implicit declaration of function ‘prinft’
    let relativeBase = file.base.substring(file.cwd.length + 1).replace('\\', '/');
    output.forEach(e => {
        let message = relativeBase + e.name + ':' + (e.startPosition.line + 1) + ':' + (e.startPosition.character + 1) + ': ' + e.failure;
        console.log('[tslint] ' + message);
    });
};
