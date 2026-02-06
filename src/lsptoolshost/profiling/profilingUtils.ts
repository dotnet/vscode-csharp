/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import archiver from 'archiver';
import { execChildProcess } from '../../common';
import { ObservableLogOutputChannel } from '../logging/observableLogOutputChannel';

/**
 * Verifies that a dotnet global tool is installed, and prompts the user to install it if not.
 * @param toolName The name of the dotnet tool (e.g., 'dotnet-trace', 'dotnet-dump', 'dotnet-gcdump')
 * @param folder The folder to run the command in
 * @param progress The progress reporter to update during installation
 * @param channel The output channel for logging
 * @returns True if the tool is installed (or was successfully installed), false otherwise
 */
export async function verifyOrAcquireDotnetTool(
    toolName: string,
    folder: string,
    progress: vscode.Progress<{
        message?: string;
        increment?: number;
    }>,
    channel: ObservableLogOutputChannel
): Promise<boolean> {
    try {
        await execChildProcess(`${toolName} --version`, folder, process.env);
        return true; // If the command succeeds, the tool is installed.
    } catch (error) {
        channel.debug(`Failed to execute ${toolName} --version with error: ${error}`);
    }

    const confirmAction = {
        title: vscode.l10n.t('Install'),
    };
    const installCommand = `dotnet tool install --global ${toolName}`;
    const confirmResult = await vscode.window.showInformationMessage(
        vscode.l10n.t({
            message: '{0} not found, run "{1}" to install it?',
            args: [toolName, installCommand],
            comment: ['{0} is the tool name and should not be localized', '{1} is the install command'],
        }),
        {
            modal: true,
        },
        confirmAction
    );

    if (confirmResult !== confirmAction) {
        return false;
    }

    progress.report({
        message: vscode.l10n.t({
            message: 'Installing {0}...',
            args: [toolName],
            comment: ['{0} is the tool name and should not be localized'],
        }),
    });

    try {
        await execChildProcess(installCommand, folder, process.env);
        return true;
    } catch (error) {
        channel.error(`Failed to install ${toolName} with error: ${error}`);
        await vscode.window.showErrorMessage(
            vscode.l10n.t({
                message: 'Failed to install {0}, it may need to be manually installed. See C# output for details.',
                args: [toolName],
                comment: ['{0} is the tool name and should not be localized'],
            }),
            {
                modal: true,
            }
        );
        return false;
    }
}

/**
 * Creates a zip file containing a single file, then cleans up the source file.
 * @param outputPath The path for the output zip file
 * @param sourceFilePath The path to the file to add to the archive
 */
export async function createZipWithFile(outputPath: string, sourceFilePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', {
            zlib: { level: 9 },
        });

        output.on('close', () => {
            // Clean up the temporary source file after adding to archive
            if (fs.existsSync(sourceFilePath)) {
                try {
                    fs.unlinkSync(sourceFilePath);
                } catch {
                    // Ignore cleanup errors
                }
            }
            resolve();
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);

        // Add the file to the archive
        archive.file(sourceFilePath, { name: path.basename(sourceFilePath) });

        void archive.finalize();
    });
}
