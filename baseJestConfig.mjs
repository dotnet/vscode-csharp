/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDefaultEsmPreset, createDefaultPreset } from 'ts-jest';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const tsconfigPath = fileURLToPath(new URL('./tsconfig.json', import.meta.url));
const jestTsconfigPath = fileURLToPath(new URL('./tsconfig.jest.json', import.meta.url));
// The override lets tooling validate the ESM transform before the repository package type changes.
const useESM = packageJson.type === 'module' || process.env.JEST_USE_ESM === 'true';
const tsJestPreset = useESM
    ? createDefaultEsmPreset({ tsconfig: tsconfigPath })
    : createDefaultPreset({ tsconfig: tsconfigPath });
const commonProjectConfig = {
    testEnvironment: 'node',
    transformIgnorePatterns: ['/dist/.+\\.js'],
};

/**
 * Defines a base project config that we can re-use across the project specific jest configs.
 * We do this because jest generally does not inherit project configuration settings.
 */
/** @type {import('jest').Config} */
export const baseProjectConfig = {
    ...tsJestPreset,
    ...commonProjectConfig,
    ...(useESM
        ? {
              moduleNameMapper: {
                  // TypeScript rewrites source .ts specifiers to .js before Jest resolves the source module.
                  '^(\\.{1,2}/.*)\\.js$': '$1',
              },
          }
        : {}),
};

// VS Code's packaged extension host strips the Node flag required by Jest's VM-module ESM runtime.
export const baseIntegrationProjectConfig = {
    ...createDefaultPreset({ tsconfig: jestTsconfigPath }),
    ...commonProjectConfig,
    moduleNameMapper: {
        // TypeScript rewrites source .ts specifiers to .js before Jest resolves the source module.
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
};
