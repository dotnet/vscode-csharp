/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as optionsSchemaGenerator from './src/tools/generateOptionsSchema';
import * as packageDependencyUpdater from './src/tools/updatePackageDependencies';
import * as es from 'event-stream';
import * as fs from 'fs';
import * as path from 'path';
import { Transform, TransformCallback } from 'stream';
import File = require('vinyl');
import * as nls from 'vscode-nls-dev';
import { XLF } from 'vscode-nls-dev';
import { KeyInfo } from 'vscode-nls-dev/lib/lib';
import { translatedLanguages } from './src/languages';

require('./tasks/testTasks');
require('./tasks/offlinePackagingTasks');
require('./tasks/backcompatTasks');

const projectName = 'vscode-extensions';
const extensionName = 'ms-dotnettools.csharp';
const repoRoot: string = path.resolve(__dirname, '..', '..');
const packageRoot: string = path.resolve(__dirname);
const packageSrcRoot: string = path.resolve(packageRoot, 'src');
const outputXlfFile: string = path.resolve(
    repoRoot,
    `${projectName}-localization-export`,
    projectName,
    `${extensionName}.xlf`
);
const inputXlfDir = process.env.LOC_ROOT ? process.env.LOC_ROOT : path.join(repoRoot, 'loc');
const i18nDir: string = path.resolve(packageRoot, 'i18n');

const filesToTranslate: string[] = ['resources.json', 'ms-dotnettools.csharp/package.nls.json'].map((name) =>
    path.resolve(packageSrcRoot, name)
);

interface ResourceMap {
    [key: string]: string;
}

function asModuleName(resourcePath: string): string {
    return path.relative(packageSrcRoot, resourcePath).replace(/\\/g, '/').replace('.json', '');
}

function addResourcesToXlf(moduleName: string, data: ResourceMap, xlf: XLF): void {
    const keys: KeyInfo[] = [];
    const messages: string[] = [];
    Object.entries(data).forEach(([key, message]) => {
        if (key.endsWith('.__comment__')) {
            return;
        }
        const commentKey = `${key}.__comment__`;
        keys.push(commentKey in data ? { key, comment: [data[commentKey]] } : key);
        messages.push(message);
    });
    xlf.addFile(moduleName, keys, messages);
}

/**
 * Export all resources defined in this package into a single XLF file.
 */
function exportXlf(): void {
    const xlf = new XLF(projectName);
    filesToTranslate.forEach((filePath) => {
        addResourcesToXlf(asModuleName(filePath), JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' })), xlf);
    });
    fs.mkdirSync(path.dirname(outputXlfFile), { recursive: true });
    fs.writeFileSync(outputXlfFile, xlf.toString(), {
        encoding: 'utf8',
    });
}

function takeWhile<T>(xs: T[], pred: (x: T) => boolean): T[] {
    const ret = [];
    for (const x of xs) {
        if (pred(x)) {
            ret.push(x);
            continue;
        }
        break;
    }
    return ret;
}

/**
 * Returns a stream that transforms inbound XLF files into JSON files suitable
 * for use with i18next. This stream is meant for consumption as part of a
 * gulp task.
 */
function importXlfStream(): es.MapStream {
    const postprocess = (): Transform =>
        new Transform({
            objectMode: true,
            transform(file: File, encoding: string, callback: TransformCallback): void {
                if (!file.isBuffer()) {
                    throw new Error('Expected file to be buffer');
                }

                // strip leading comments because they are not valid JSON
                // See vscode-nls-dev for hardcoded comment:
                // https://github.com/microsoft/vscode-nls-dev/blob/3c1c16e7f1bae7717d29a6ef2fa2849758c56cec/src/main.ts#L610-L615
                const lines: string[] = file.contents.toString().split('\n');
                const numToSkip = takeWhile(lines, (line: string) => /^(?:\/\*| \*|\/\/)/.test(line)).length;
                lines.splice(0, numToSkip);
                file.contents = Buffer.from(lines.join('\n'));

                // remove i18n from filename
                file.path = file.path.replace('i18n.', '');
                return callback(null, file);
            },
        });

    return es.merge(
        translatedLanguages().map((language) => {
            const xlfPath = path.join(
                inputXlfDir,
                language.transifex,
                `${projectName}-localization-export`,
                projectName,
                `${extensionName}.${language.transifex}.xlf`
            );
            return (
                gulp
                    .src(xlfPath, { allowEmpty: true })
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .pipe(nls.prepareJsonFiles() as any)
                    .pipe(postprocess())
                    .pipe(gulp.dest(i18nDir))
            );
        })
    );
}

gulp.task('translations-export', (done) => {
    exportXlf();
    done();
});

gulp.task('translations-import', (done) => {
    importXlfStream().pipe(
        es.wait(() => {
            done();
        })
    );
});

// Disable warning about wanting an async function
// tslint:disable-next-line
gulp.task('generateOptionsSchema', async (): Promise<void> => {
    optionsSchemaGenerator.GenerateOptionsSchema();
    return Promise.resolve();
});

// Disable warning about wanting an async function
// tslint:disable-next-line
gulp.task('updatePackageDependencies', async (): Promise<void> => {
    return packageDependencyUpdater.updatePackageDependencies();
});
