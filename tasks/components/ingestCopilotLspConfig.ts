/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'node:fs/promises';
import * as https from 'node:https';
import * as path from 'node:path';
import { runTask } from '../runTask';
import { rootPath } from '../projectPaths';

const sourceUrl = 'https://raw.githubusercontent.com/dotnet/skills/main/plugins/dotnet/lsp.json';
const outputPath = path.join(rootPath, 'redist', 'lsp-config.json');

runTask(ingestCopilotLspConfig);

async function ingestCopilotLspConfig() {
    const content = await downloadText(sourceUrl);
    validateLspConfig(content, sourceUrl);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content, 'utf8');
    console.log(`Updated ${outputPath} from ${sourceUrl}`);
}

function validateLspConfig(content: string, source: string): void {
    let parsed: unknown;
    try {
        parsed = JSON.parse(content) as unknown;
    } catch {
        throw new Error(`Failed to parse JSON from ${source}.`);
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new Error(`Downloaded config from ${source} is not a JSON object.`);
    }

    const lspServers = (parsed as { lspServers?: unknown }).lspServers;
    if (!lspServers || typeof lspServers !== 'object') {
        throw new Error(`Downloaded config from ${source} is missing lspServers.`);
    }

    const csharp = (lspServers as { csharp?: unknown }).csharp;
    if (!csharp || typeof csharp !== 'object') {
        throw new Error(`Downloaded config from ${source} is missing lspServers.csharp.`);
    }
}

async function downloadText(url: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        https
            .get(url, (response) => {
                if (!response.statusCode) {
                    reject(new Error(`Failed to download ${url}: missing status code.`));
                    return;
                }

                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    response.resume();
                    void downloadText(response.headers.location).then(resolve, reject);
                    return;
                }

                if (response.statusCode < 200 || response.statusCode >= 300) {
                    reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}.`));
                    return;
                }

                response.setEncoding('utf8');
                let content = '';
                response.on('data', (chunk) => {
                    content += chunk;
                });
                response.on('end', () => {
                    resolve(content);
                });
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}
