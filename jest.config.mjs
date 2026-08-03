/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/** @type {import('jest').Config} */
const config = {
    projects: [
        '<rootDir>/test/lsptoolshost/artifactTests/jest.config.mjs',
        '<rootDir>/test/lsptoolshost/integrationTests/jest.config.mjs',
        '<rootDir>/test/lsptoolshost/unitTests/jest.config.mjs',
        '<rootDir>/test/omnisharp/omnisharpIntegrationTests/jest.config.mjs',
        '<rootDir>/test/omnisharp/omnisharpUnitTests/jest.config.mjs',
        '<rootDir>/test/razor/razorIntegrationTests/jest.config.mjs',
        '<rootDir>/test/razor/razorTests/jest.config.mjs',
        '<rootDir>/test/untrustedWorkspace/integrationTests/jest.config.mjs',
        '<rootDir>/test/tasks/jest.config.mjs',
    ],
    // Reporters are a global jest configuration property and cannot be set in the project jest config.
    // This configuration will create a 'junit.xml' file in the output directory, no matter which test project is running.
    // In order to not overwrite test results in CI, we configure a unique output file name in the testTasks.
    reporters: [
        'default',
        [
            'jest-junit',
            {
                outputDirectory: '<rootDir>/out/',
                reportTestSuiteErrors: 'true',
                // Azure DevOps does not display test suites (it ignores them entirely).
                // So we have to put all the info in the test case name so the UI shows anything relatively useful.
                // See https://github.com/microsoft/azure-pipelines-tasks/issues/7659
                classNameTemplate: '{suitename}',
                titleTemplate: `${process.env.JEST_SUITE_NAME} {suitename} / {title}`,
            },
        ],
    ],
};

export default config;
