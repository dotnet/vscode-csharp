/*--------------------------------------------------------- 
 * Copyright (C) Microsoft Corporation. All rights reserved. 
 *--------------------------------------------------------*/


'use strict';
import path = require('path');
const fs = require('async-file');
import Mocha = require('mocha');
import istanbul = require('istanbul');
const loadCoverage = require('remap-istanbul/lib/loadCoverage');
const remap = require('remap-istanbul/lib/remap');
const writeReport = require('remap-istanbul/lib/writeReport');

declare var __coverage__: any;
let glob = require('glob');
let remapIstanbul = require('remap-istanbul');

export default class CoverageWritingTestRunner {
    constructor(private baseRunner: any) {
    }

    public configure(mochaOpts: any) {
        this.baseRunner.configure(mochaOpts);
    }

    public run(testRoot: string, clb: any) {
        let promiseResolve: any;

        new Promise<void>(function (resolve, reject) {
                promiseResolve = () => resolve();
            })
            .then(this.writeCoverage)
            .then(clb);

        this.baseRunner.run(testRoot, promiseResolve);
    }

    private async writeCoverage(): Promise<void> {
        if (__coverage__) {
            let nycFolderPath = path.join(process.env.CODE_EXTENSIONS_PATH, ".nyc_output");

            if (!(await fs.exists(nycFolderPath))) {
                await fs.mkdir(nycFolderPath);
            }

            let rawCoverageJsonPath = path.join(nycFolderPath, `${process.env.OSVC_SUITE}.json`);
            let remappedCoverageJsonPath = path.join(nycFolderPath, `${process.env.OSVC_SUITE}.remapped.json`);
            let outFolderPath = path.join(process.env.CODE_EXTENSIONS_PATH, "out");

            await fs.writeTextFile(rawCoverageJsonPath, JSON.stringify(__coverage__));
        }
    }
}

// class CoverageRunner { 

//     private coverageVar: string = '$$cov_' + new Date().getTime() + '$$'; 
//     private transformer: any = undefined; 
//     private matchFn: any = undefined; 
//     private instrumenter: any = undefined; 

//     constructor(private options: ITestRunnerOptions, private testsRoot: string, private endRunCallback: any) { 
//         if (!options.relativeSourcePath) { 
//             return endRunCallback('Error - relativeSourcePath must be defined for code coverage to work'); 
//         } 

//     } 

//     public setupCoverage(): void { 
//         // Set up Code Coverage, hooking require so that instrumented code is returned 
//         let self = this; 
//         self.instrumenter = new istanbul.Instrumenter({ coverageVariable: self.coverageVar }); 
//         let sourceRoot = paths.join(self.testsRoot, self.options.relativeSourcePath); 

//         // Glob source files 
//         let srcFiles = glob.sync('**/**.js', { 
//             ignore: self.options.ignorePatterns, 
//             cwd: sourceRoot 
//         }); 

//         // Create a match function - taken from the run-with-cover.js in istanbul. 
//         let decache = require('decache'); 
//         let fileMap = {}; 
//         srcFiles.forEach(file => { 
//             let fullPath = paths.join(sourceRoot, file); 
//             fileMap[fullPath] = true; 

//             // On Windows, extension is loaded pre-test hooks and this mean we lose 
//             // our chance to hook the Require call. In order to instrument the code 
//             // we have to decache the JS file so on next load it gets instrumented. 
//             // This doesn't impact tests, but is a concern if we had some integration 
//             // tests that relied on VSCode accessing our module since there could be 
//             // some shared global state that we lose. 
//             decache(fullPath); 
//         }); 

//         self.matchFn = function (file): boolean { return fileMap[file]; }; 
//         self.matchFn.files = Object.keys(fileMap); 

//         // Hook up to the Require function so that when this is called, if any of our source files 
//         // are required, the instrumented version is pulled in instead. These instrumented versions 
//         // write to a global coverage variable with hit counts whenever they are accessed 
//         self.transformer = self.instrumenter.instrumentSync.bind(self.instrumenter); 
//         let hookOpts = { verbose: false, extensions: ['.js']}; 
//         istanbul.hook.hookRequire(self.matchFn, self.transformer, hookOpts); 

//         // initialize the global variable to stop mocha from complaining about leaks 
//         global[self.coverageVar] = {}; 

//         // Hook the process exit event to handle reporting 
//         // Only report coverage if the process is exiting successfully 
//         process.on('exit', (code) => { 
//             self.reportCoverage(); 
//         }); 
//     } 


//     /** 
//      * Writes a coverage report. Note that as this is called in the process exit callback, all calls must be synchronous. 
//      * 
//      * @returns {void} 
//      * 
//      * @memberOf CoverageRunner 
//      */ 
//     public reportCoverage(): void { 
//         let self = this; 
//         istanbul.hook.unhookRequire(); 
//         let cov: any; 
//         if (typeof global[self.coverageVar] === 'undefined' || Object.keys(global[self.coverageVar]).length === 0) { 
//             console.error('No coverage information was collected, exit without writing coverage information'); 
//             return; 
//         } else { 
//             cov = global[self.coverageVar]; 
//         } 

//         // TODO consider putting this under a conditional flag 
//         // Files that are not touched by code ran by the test runner is manually instrumented, to 
//         // illustrate the missing coverage. 
//         self.matchFn.files.forEach(file => { 
//             if (!cov[file]) { 
//                 self.transformer(fs.readFileSync(file, 'utf-8'), file); 

//                 // When instrumenting the code, istanbul will give each FunctionDeclaration a value of 1 in coverState.s, 
//                 // presumably to compensate for function hoisting. We need to reset this, as the function was not hoisted, 
//                 // as it was never loaded. 
//                 Object.keys(self.instrumenter.coverState.s).forEach(key => { 
//                     self.instrumenter.coverState.s[key] = 0; 
//                 }); 

//                 cov[file] = self.instrumenter.coverState; 
//             } 
//         }); 

//         // TODO Allow config of reporting directory with 
//         let reportingDir = paths.join(self.testsRoot, self.options.relativeCoverageDir); 
//         let includePid = true; 
//         let pidExt = includePid ? ('-' + process.pid) : '', 
//         coverageFile = paths.resolve(reportingDir, 'coverage' + pidExt + '.json'); 

//         _mkDirIfExists(reportingDir); // yes, do this again since some test runners could clean the dir initially created 

//         fs.writeFileSync(coverageFile, JSON.stringify(cov), 'utf8'); 

//         let remappedCollector: istanbul.Collector = remapIstanbul.remap(cov, {warn: warning => { 
//             // We expect some warnings as any JS file without a typescript mapping will cause this. 
//             // By default, we'll skip printing these to the console as it clutters it up 
//             if (self.options.verbose) { 
//                 console.warn(warning); 
//             } 
//         }}); 

//         let reporter = new istanbul.Reporter(undefined, reportingDir); 
//         reporter.addAll(['lcov']); 
//         reporter.write(remappedCollector, true, () => { 
//             console.log(`reports written to ${reportingDir}`); 
//         }); 
//     } 
// } 
// File contents are unchanged.