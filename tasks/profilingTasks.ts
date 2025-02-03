/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import fs from 'fs';
import * as gulp from 'gulp';
import * as path from 'path';
import { basicSlnTestProject, runIntegrationTest } from './testHelpers';
import { outPath } from './projectPaths';
import { execSync } from 'child_process';

createProfilingTasks();

function createProfilingTasks() {
    const profilingOutputFolder = path.join(outPath, 'profiling');
    gulp.task(`profiling:csharp:${basicSlnTestProject}`, async () => {
        // Ensure the profiling output folder exists, otherwise the outputs will not get written.
        fs.mkdirSync(path.join(outPath, 'profiling'), { recursive: true });

        await runIntegrationTest(
            basicSlnTestProject,
            path.join('lsptoolshost', 'integrationTests'),
            `[C#][${basicSlnTestProject}]`,
            undefined,
            undefined,
            {
                ROSLYN_DOTNET_EventPipeOutputPath: path.join(profilingOutputFolder, 'csharp-trace.{pid}.nettrace'),
            }
        );

        const files = fs.readdirSync(profilingOutputFolder);
        const nettraceFiles = files.filter((f) => f.endsWith('.nettrace'));
        if (nettraceFiles.length === 0) {
            throw new Error('No .nettrace files found in the profiling output folder.');
        }
    });

    gulp.task('mergeTraces', async () => {
        await mergeTraces(profilingOutputFolder);
    });

    gulp.task('profiling', gulp.series(`profiling:csharp:${basicSlnTestProject}`, 'mergeTraces'));
}

async function mergeTraces(profilingOutputFolder: string) {
    const files = fs.readdirSync(profilingOutputFolder);
    const nettraceFiles = files.filter((f) => f.endsWith('.nettrace'));
    if (nettraceFiles.length === 0) {
        throw new Error('No .nettrace files found in the profiling output folder.');
    }

    // Function to spawn a tool
    function spawnTool(command: string, args: string[], warnOnError = false) {
        try {
            console.log(`##[command] ${command} ${args.join(' ')}`);
            execSync(`${command} ${args.join(' ')}`, { stdio: 'inherit' });
        } catch (error) {
            if (warnOnError) {
                console.warn(`Failed: ${error}`);
            } else {
                throw error;
            }
        }
    }

    // Ensure the dotnet-pgo tool is installed.
    // Additional versions of this can be found at https://dev.azure.com/dnceng/public/_artifacts/feed/dotnet8-transport/NuGet/dotnet-pgo/
    spawnTool('dotnet', [
        'tool',
        'update',
        '-g',
        'dotnet-pgo',
        '--version',
        '8.0.0-rc.2.23479.6',
        '--add-source',
        'https://pkgs.dev.azure.com/azure-public/vside/_packaging/msft_consumption/nuget/v3/index.json',
        '--ignore-failed-sources',
    ]);

    console.log('##[group] Converting .nettrace to .mibc');
    nettraceFiles.forEach((file) => {
        spawnTool(
            'dotnet-pgo',
            [
                'create-mibc',
                '-t',
                path.join(profilingOutputFolder, file),
                '-o',
                path.join(profilingOutputFolder, `${path.basename(file, '.nettrace')}.mibc`),
            ],
            true
        );
    });
    console.log('##[endgroup]');

    const mibcFiles = fs.readdirSync(profilingOutputFolder).filter((f) => f.endsWith('.mibc'));
    if (mibcFiles.length === 0) {
        throw new Error('No .mibc files were produced.');
    }

    const mergedTraceLocation = path.join(profilingOutputFolder, 'merged');
    fs.mkdirSync(mergedTraceLocation, { recursive: true });

    const inputArgs = ['merge', '--compressed'];
    mibcFiles.forEach((file) => {
        inputArgs.push('-i', path.join(profilingOutputFolder, file));
    });
    inputArgs.push('-o', path.join(mergedTraceLocation, 'merged.mibc'));

    spawnTool('dotnet-pgo', inputArgs);
}
