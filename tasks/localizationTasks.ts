/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import { Octokit, App } from "octokit";

gulp.task('publish localization content', async () => {
    const userName = process.argv[1];
    const email = process.argv[2];
});
