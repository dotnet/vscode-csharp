/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as del from 'del';
import * as fs from 'fs';
import * as gulp from 'gulp';
import { onlineVscodeignorePath, unpackedVsixPath, vscePath, vscodeignorePath } from './projectPaths';
import { getPackageJSON } from './packageJson';
import spawnNode from './spawnNode';
import { Extract } from 'unzipper';

gulp.task('vsix:release:unpackage', () => {
    const packageJSON = getPackageJSON();
    const name = packageJSON.name;
    const version = packageJSON.version;
    const packageName = `${name}-${version}.vsix`;

    del.sync(unpackedVsixPath);
    return fs.createReadStream(packageName).pipe(Extract({ path: unpackedVsixPath }));
});

gulp.task('vsix:release:package', async (onError) => {
    del.sync(vscodeignorePath);

    fs.copyFileSync(onlineVscodeignorePath, vscodeignorePath);

    try {
        await spawnNode([vscePath, 'package']);
    }
    finally {
        await del(vscodeignorePath);
    }
});