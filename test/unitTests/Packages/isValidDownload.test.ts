/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isValidDownload } from "../../../src/packageManager/isValidDownload";
import { createTestFile } from "../testAssets/TestFile";
import TestZip from "../testAssets/TestZip";
import * as chai from "chai";

chai.should();
const expect = chai.expect;

suite(`${isValidDownload.name}`, () => {
    const files = [
        createTestFile("file1", "file1.txt"),
        createTestFile("file2", "file2.txt")
    ];

    let testZip: TestZip; 

    setup(async() => {
        testZip = await TestZip.createTestZipAsync(...files);
    });
    
    test('Returns false for non-matching integrity', async () => {
        let result = await isValidDownload(testZip.buffer, "inValidIntegrity");
        expect(result).to.be.false;
    });

    test('Returns true for matching integrity', async () => {
        let result = await isValidDownload(testZip.buffer, "212785b9cf15888785ed55a9357b4c4e29d0acca6a978ccb1df7cc8ee7423071");
        expect(result).to.be.true;
    });
});