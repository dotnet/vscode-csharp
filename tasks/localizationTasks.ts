/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as git from 'simple-git';
import { file } from 'tmp';

gulp.task('publish localization content', async () => {
    const hasChange = await HasChange();
    if (!hasChange) {
        console.log('git status is clean. Skip publishing localization content.');
        return;
    }

    const diffSummary = await git.simpleGit().diffSummary();
    const changedFiles = diffSummary.files.map((diffFile) => diffFile.file);


});

async function HasChange(): Promise<boolean> {
    const status = await git.simpleGit().status();
    return status.isClean();
}
