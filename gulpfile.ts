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
require('./tasks/coverageTasks');

gulp.task('generateOptionsSchema', () => {
    optionsSchemaGenerator.GenerateOptionsSchema();
});

gulp.task('updatePackageDependencies', () => {
    packageDependencyUpdater.updatePackageDependencies();
});

gulp.task('tslint', () => {
    return gulp.src([
        '**/*.ts',
        '!**/*.d.ts',
        '!**/typings**',
        '!node_modules/**',
        '!vsix/**'
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