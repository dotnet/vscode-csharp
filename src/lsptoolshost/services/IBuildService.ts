/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Provides additional options to be used by the build.
 */
export class BuildOptions {
    /**
     * the configuration to build. Not currently implemented.
     */
    configuration?: string;
}

/**
 * This service provides a way to build the solution or a specific project.
 */
export interface IBuildService {
    /**
     * builds the specified solution or project.
     * @param solutionOrProject the path to the project or solution to build.
     * @param buildOptions additional options.
     * @returns True if the build succeeded, false otherwise.
     */
    build(solutionOrProject: string, buildOptions?: BuildOptions): Promise<boolean>;
}
