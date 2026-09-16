/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { closeSync, openSync, rmSync, rmdirSync } from 'fs';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { NestedError } from '../src/nestedError';

export async function CreateTmpFile(): Promise<TmpAsset> {
    const directory = await createTemporaryDirectory();
    const name = join(directory, 'package');
    let fd: number;
    try {
        fd = openSync(name, 'wx+');
    } catch (error) {
        rmSync(directory, { recursive: true, force: true });
        throw new NestedError('Error creating temporary file', error as Error);
    }

    return {
        fd,
        name,
        dispose: () => {
            closeSync(fd);
            rmSync(directory, { recursive: true, force: true });
        },
    };
}

export async function CreateTmpDir(unsafeCleanup: boolean): Promise<TmpAsset> {
    const name = await createTemporaryDirectory();

    return {
        fd: -1,
        name,
        dispose: () => {
            if (unsafeCleanup) {
                rmSync(name, { recursive: true, force: true });
            } else {
                rmdirSync(name);
            }
        },
    };
}

async function createTemporaryDirectory(): Promise<string> {
    try {
        return await mkdtemp(join(tmpdir(), 'package-'));
    } catch (error) {
        throw new NestedError('Error creating temporary directory', error as Error);
    }
}

export interface TmpAsset {
    fd: number;
    name: string;
    dispose: () => void;
}
