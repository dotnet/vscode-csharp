/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';

gulp.task('package:neutral', gulp.series('vsix:release:package:neutral-clean'));
gulp.task('package:offline', gulp.series('vsix:release:package'));
gulp.task('vsix:offline:package', gulp.series('vsix:release:package'));
