/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/


'use strict';

import {execAsync} from 'async-child-process';

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
        let clbArgsLocal: {error, failures?: number};

        new Promise<{error, failures?: number}>(function (resolve, reject) {
            promiseResolve = (error, failures?: number) => resolve({error, failures});
        })
            .then(clbArgs => {
                clbArgsLocal = clbArgs;
                return this.writeCoverage();
            })
            .then(() => clb(clbArgsLocal.error, clbArgsLocal.failures),
                  () => clb(clbArgsLocal.error, clbArgsLocal.failures));

        this.baseRunner.run(testRoot, promiseResolve);
    }

    private async writeCoverage(): Promise<void> {
        if (typeof __coverage__ !== 'undefined') {
            let nycFolderPath = path.join(process.env.CODE_EXTENSIONS_PATH, ".nyc_output");

            if (!(await fs.exists(nycFolderPath))) {
                await fs.mkdir(nycFolderPath);
            }

            let rawCoverageJsonPath = path.join(nycFolderPath, `${process.env.OSVC_SUITE}.json`);
            let remappedCoverageJsonPath = path.join(nycFolderPath, `${process.env.OSVC_SUITE}.remapped.json`);
            let outFolderPath = path.join(process.env.CODE_EXTENSIONS_PATH, "out");
            let remapIstanbulPath = path.join(process.env.CODE_EXTENSIONS_PATH, "node_modules", "remap-istanbul", "bin", "remap-istanbul.js");
console.log(`rawCoverageJsonPath: ${rawCoverageJsonPath}`);
console.log(`remappedCoverageJsonPath: ${remappedCoverageJsonPath}`);
console.log(`outFolderPath: ${outFolderPath}`);
console.log(`remapIstanbulPath: ${remapIstanbulPath}`);
            await fs.writeTextFile(rawCoverageJsonPath, JSON.stringify(__coverage__));


            let result = await execAsync(`node ${remapIstanbulPath} -i ${rawCoverageJsonPath} -o ${remappedCoverageJsonPath}`, {
                cwd: outFolderPath
            });


            let remappedResult = JSON.parse(await fs.readTextFile(remappedCoverageJsonPath));
console.log(JSON.stringify(remappedResult));
            let finalResult = {};

            for (let key in remappedResult){
                if (remappedResult[key].path) {
                    let realPath = key.replace("../", "./");
console.log(`${key} -> ${realPath}`);
                    finalResult[realPath] = remappedResult[key];
                    finalResult[realPath].path = realPath;
                }
                else {
                    finalResult[key] = remappedResult[key];
                }
            }
console.log(`done remapping ${finalResult}`);
            await fs.writeTextFile(remappedCoverageJsonPath, JSON.stringify(finalResult));
        }
    }
}
