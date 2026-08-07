/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { ChildProcess, SpawnOptions } from 'child_process';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { runDotnetMsBuild } from '../../../src/shared/jsonSchema/dotnetMsBuildEvaluator';

describe('dotnet msbuild JSON schema evaluation', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    test('spawns dotnet with an argument array and no shell', async () => {
        const child = createChildProcess();
        const spawn = jest.fn((_command: string, _args: readonly string[], _options: SpawnOptions) => child);
        const projectPath = path.resolve('workspace with spaces', 'project;echo-not-a-command.csproj');
        const promise = runDotnetMsBuild(projectPath, {
            spawn,
            timeoutMilliseconds: 1_000,
            maxOutputBytes: 1_024,
        });

        child.stdout!.emit('data', Buffer.from('{"Items":{"JsonSchemaSegment":[]}}'));
        child.emit('close', 0, null);

        await expect(promise).resolves.toBe('{"Items":{"JsonSchemaSegment":[]}}');
        expect(spawn).toHaveBeenCalledWith(
            'dotnet',
            ['msbuild', projectPath, '-getItem:JsonSchemaSegment', '-nologo'],
            expect.objectContaining({
                cwd: path.dirname(projectPath),
                shell: false,
                windowsHide: true,
                env: expect.objectContaining({
                    MSBUILDDISABLENODEREUSE: '1',
                    DOTNET_CLI_UI_LANGUAGE: 'en-US',
                }),
            })
        );
    });

    test('uses the configured dotnet executable when one is supplied', async () => {
        const child = createChildProcess();
        const spawn = jest.fn((_command: string, _args: readonly string[], _options: SpawnOptions) => child);
        const dotnetExecutablePath = path.resolve('custom', 'dotnet');
        const promise = runDotnetMsBuild(path.resolve('app.csproj'), {
            spawn,
            dotnetExecutablePath,
            timeoutMilliseconds: 1_000,
            maxOutputBytes: 1_024,
        });

        child.emit('close', 0, null);

        await expect(promise).resolves.toBe('');
        expect(spawn).toHaveBeenCalledWith(dotnetExecutablePath, expect.anything(), expect.anything());
    });

    test('rejects with the standard error output when the evaluation fails', async () => {
        const child = createChildProcess();
        const promise = runDotnetMsBuild(path.resolve('broken.csproj'), {
            spawn: () => child,
            timeoutMilliseconds: 1_000,
            maxOutputBytes: 1_024,
        });

        child.stderr!.emit('data', Buffer.from('MSB1009: Project file does not exist.'));
        child.emit('close', 1, null);

        await expect(promise).rejects.toThrow('MSB1009');
    });

    test('kills evaluation when output exceeds the configured bound', async () => {
        const child = createChildProcess();
        const promise = runDotnetMsBuild(path.resolve('app.csproj'), {
            spawn: () => child,
            timeoutMilliseconds: 1_000,
            maxOutputBytes: 4,
        });

        child.stdout!.emit('data', Buffer.from('12345'));

        await expect(promise).rejects.toThrow('output limit');
        expect(child.kill).toHaveBeenCalledTimes(1);
    });

    test('kills evaluation when it times out or is cancelled', async () => {
        jest.useFakeTimers();
        const timedOutChild = createChildProcess();
        const timedOut = runDotnetMsBuild(path.resolve('timeout.csproj'), {
            spawn: () => timedOutChild,
            timeoutMilliseconds: 50,
            maxOutputBytes: 1_024,
        });
        const timedOutExpectation = expect(timedOut).rejects.toThrow('timed out');

        await jest.advanceTimersByTimeAsync(50);

        await timedOutExpectation;
        expect(timedOutChild.kill).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(1_000);
        expect(timedOutChild.kill).toHaveBeenLastCalledWith('SIGKILL');

        const cancelledChild = createChildProcess();
        const cancellation = new AbortController();
        const cancelled = runDotnetMsBuild(path.resolve('cancelled.csproj'), {
            spawn: () => cancelledChild,
            timeoutMilliseconds: 1_000,
            maxOutputBytes: 1_024,
            signal: cancellation.signal,
        });
        const cancelledExpectation = expect(cancelled).rejects.toThrow('cancelled');

        cancellation.abort();

        await cancelledExpectation;
        expect(cancelledChild.kill).toHaveBeenCalledTimes(1);
    });

    test('does not spawn a process when cancellation was already requested', async () => {
        const spawn = jest.fn((_command: string, _args: readonly string[], _options: SpawnOptions) =>
            createChildProcess()
        );
        const cancellation = new AbortController();
        cancellation.abort();

        await expect(
            runDotnetMsBuild(path.resolve('app.csproj'), {
                spawn,
                timeoutMilliseconds: 1_000,
                maxOutputBytes: 1_024,
                signal: cancellation.signal,
            })
        ).rejects.toThrow('cancelled');
        expect(spawn).not.toHaveBeenCalled();
    });
});

function createChildProcess(): ChildProcess & {
    kill: jest.MockedFunction<(signal?: NodeJS.Signals | number) => boolean>;
} {
    const child = new EventEmitter() as ChildProcess & {
        kill: jest.MockedFunction<(signal?: NodeJS.Signals | number) => boolean>;
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = jest.fn(() => true);
    return child;
}
