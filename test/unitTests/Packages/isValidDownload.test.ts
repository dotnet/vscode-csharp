/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isValidDownload } from "../../../src/packageManager/isValidDownload";
import * as chai from "chai";
import { EventStream } from "../../../src/EventStream";

chai.should();
const expect = chai.expect;

suite(`${isValidDownload.name}`, () => {
    const sampleBuffer = Buffer.from("sampleBuffer");
    const validIntegrity = "eb7201b5d986919e0ac67c820886358869d8f7059193d33c902ad7fe1688e1e9";

    test('Returns false for non-matching integrity', async () => {
        let result = await isValidDownload(sampleBuffer, "inValidIntegrity", new EventStream());
        expect(result).to.be.false;
    });

    test('Returns true for matching integrity', async () => {
        let result = await isValidDownload(sampleBuffer, validIntegrity, new EventStream());
        expect(result).to.be.true;
    });

    test('Returns true if no integrity has been specified', async () => {
        let result = await isValidDownload(sampleBuffer, undefined, new EventStream());
        expect(result).to.be.true;
    });
});