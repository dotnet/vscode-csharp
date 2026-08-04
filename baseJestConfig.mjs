/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDefaultEsmPreset, createDefaultPreset } from 'ts-jest';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const tsconfig = fileURLToPath(new URL('./tsconfig.json', import.meta.url));
// The override lets tooling validate the ESM transform before the repository package type changes.
const useESM = packageJson.type === 'module' || process.env.JEST_USE_ESM === 'true';
const tsJestPreset = useESM
    ? createDefaultEsmPreset({ tsconfig })
    : createDefaultPreset({ tsconfig });

/**
 * Defines a base project config that we can re-use across the project specific jest configs.
 * We do this because jest generally does not inherit project configuration settings.
 */
/** @type {import('jest').Config} */
export const baseProjectConfig = {
    ...tsJestPreset,
    testEnvironment: 'node',
    transformIgnorePatterns: ['/dist/.+\\.js'],
    ...(useESM
        ? {
              moduleNameMapper: {
                  '^(\\.{1,2}/.*)\\.js$': '$1',
              },
          }
        : {}),
};
