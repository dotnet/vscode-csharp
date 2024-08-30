#!/bin/sh
# set -x
set -e

rs="_patches/replacer.py"

# Patch tasks/backcompatTasks.ts
sed -i "8i gulp.task('package:neutral', gulp.series('vsix:release:package:neutral-clean'));" tasks/backcompatTasks.ts

# Patch tasks/offlinePackagingTasks.ts
pattern="gulp\.task\('vsix:release:package:neutral', async \(\) => {
    await doPackageOffline\(undefined\);
}\);"
replacement="gulp.task('vsix:release:package:neutral', async () => {
    await doPackageOffline(undefined);
});

async function doPackageNeutral() {
    let prerelease = false;
    if (argv.prerelease) {
        prerelease = true;
    }

    try {
        // Get the package.json.
        const packageJSON = getPackageJSON();
        // Output the platform neutral VSIX using the platform neutral server bits we created before.
        await buildVsix(packageJSON, packedVsixOutputRoot, prerelease);
    } catch (err) {
        console.log(err);
    }
}

gulp.task('vsix:release:package:neutral-clean', async () => {
    await cleanAsync();
    await doPackageNeutral();
});
"
python "$rs" "tasks/offlinePackagingTasks.ts" "$pattern" "$replacement"

pattern="gulp\.task\(
    'vsix:release:package',
    gulp\.series\(
        'vsix:release:package:windows',
        'vsix:release:package:linux',
        'vsix:release:package:darwin',
        'vsix:release:package:neutral'
    \)
\);"
replacement="gulp.task(
    'vsix:release:package',
    gulp.series(
        'vsix:release:package:windows',
        'vsix:release:package:linux',
        'vsix:release:package:darwin',
        'vsix:release:package:neutral-clean'
    )
);"
python "$rs" "tasks/offlinePackagingTasks.ts" "$pattern" "$replacement"