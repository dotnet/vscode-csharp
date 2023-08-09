/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';

gulp.task('Tag release information to dotnet/roslyn', async () => {
    const packageJson = JSON.parse('../package.json');
    const roslynVersion = packageJson['defaults']['roslyn'];
    if (!roslynVersion) {
        LogError("Can't find roslyn version in package.json");
        return 1;
    }

    // const languageServerPackageName = 'Microsoft.CodeAnalysis.LanguageServer';
});

function LogError(message: string): void {
    console.log(`##vso[task.logissue type=error]${message}`);
}
