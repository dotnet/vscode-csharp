import esbuild from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { auditBundle } from './tasks/compilation/bundleAudit.mjs';

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

/**
 * The telemetry package advertises an ESM module but has no exports map, so esbuild's Node
 * resolution otherwise selects its CommonJS main entry.
 */
const telemetryEsmLoaderPlugin = {
    name: 'telemetryEsmLoaderPlugin',

    setup(build) {
        build.onResolve({ filter: /^@vscode\/extension-telemetry$/ }, async () => {
            const packageDirectory = path.resolve('node_modules/@vscode/extension-telemetry');
            const packageMetadata = JSON.parse(
                await fs.readFile(path.join(packageDirectory, 'package.json'), 'utf8')
            );
            if (typeof packageMetadata.module !== 'string') {
                throw new Error('@vscode/extension-telemetry no longer declares an ESM module entry.');
            }

            return { path: path.resolve(packageDirectory, packageMetadata.module) };
        });
    },
};

const bundleAuditPlugin = {
    name: 'bundleAuditPlugin',

    setup(build) {
        build.onEnd(async (result) => {
            if (result.errors.length > 0) {
                return;
            }

            try {
                await auditBundle(result.metafile, production);
            } catch (error) {
                return {
                    errors: [{ text: error instanceof Error ? error.message : String(error) }],
                };
            }
        });
    },
};

async function main() {
    const ctx = await esbuild.context({
        entryPoints: ['src/main.ts'],
        bundle: true,
        format: 'esm',
        // Bundled CommonJS dependencies still use require and CommonJS path globals at runtime.
        // The exact require owners are enforced by bundleAuditPlugin so this bridge cannot grow unnoticed.
        banner: {
            js: [
                `import { createRequire } from 'node:module';`,
                `import { dirname as __pathDirname } from 'node:path';`,
                `import { fileURLToPath as __fileURLToPath } from 'node:url';`,
                `const require = createRequire(import.meta.url);`,
                `const __filename = __fileURLToPath(import.meta.url);`,
                `const __dirname = __pathDirname(__filename);`,
            ].join('\n'),
        },
        metafile: true,
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'node',
        outfile: 'dist/extension.mjs',
        external: ['vscode', 'applicationinsights-native-metrics', '@opentelemetry/tracing'],
        logLevel: 'info',
        plugins: [
            umdEsmLoaderPlugin,
            telemetryEsmLoaderPlugin,
            /* add to the end of plugins array */
            esbuildProblemMatcherPlugin,
            bundleAuditPlugin,
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
