import esbuild from 'esbuild';
import fs from 'node:fs/promises';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',

    setup(build) {
        build.onStart(() => {
            console.log('[watch] build started');
        });
        build.onEnd((result) => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                console.error(`    ${location.file}:${location.line}:${location.column}:`);
            });
            console.log('[watch] build finished');
        });
    },
};

/**
 * Some VSCode libraries include UMD versions that are not esbuild compatible, and also have broken ESM packages.
 * This plugin replaces the UMD imports with the ESM imports.
 * See https://github.com/microsoft/vscode/issues/192144
 */
const umdEsmLoaderPlugin = {
    name: 'umdEsmLoaderPlugin',

    setup(build) {
        build.onLoad({ filter: /(vscode-html-languageservice|jsonc-parser).*lib[\/\\]umd/ }, async (moduleArgs) => {
            // replace the umd path with the esm path from the package.
            const newPath = moduleArgs.path.replace(/(.*)lib([\/\\])umd(.*)/, '$1lib$2esm$3');
            const contents = await fs.readFile(newPath, 'utf8');
            return { contents: contents };
        });
    },
};

async function main() {
    const ctx = await esbuild.context({
        entryPoints: ['src/main.ts'],
        bundle: true,
        format: 'esm',
        banner: {
            js: [
                `import { createRequire } from 'node:module';`,
                `import { dirname as commonJsDirname } from 'node:path';`,
                `import { fileURLToPath as commonJsFileURLToPath } from 'node:url';`,
                `const require = createRequire(import.meta.url);`,
                `// Temporary CommonJS globals until bundled source usages are converted to ESM.`,
                `const __filename = commonJsFileURLToPath(import.meta.url);`,
                `const __dirname = commonJsDirname(__filename);`,
            ].join('\n'),
        },
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'node',
        outfile: 'dist/extension.mjs',
        external: ['vscode', 'applicationinsights-native-metrics', '@opentelemetry/tracing'],
        logLevel: 'info',
        plugins: [
            umdEsmLoaderPlugin,
            /* add to the end of plugins array */
            esbuildProblemMatcherPlugin,
        ],
    });
    if (watch) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
