/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs';
import * as tmp from 'tmp';
import * as vscode from 'vscode';
import {getDefaultOmnisharpInstallLocation} from './omnisharpPath';
import {OmnisharpServer} from './omnisharpServer';

const Decompress = require('decompress');
const GitHub = require('github-releases');

const OmnisharpRepo = 'OmniSharp/omnisharp-roslyn';
const OmnisharpVersion = 'v1.6.7.9';

tmp.setGracefulCleanup();

export function downloadOmnisharp(): Promise<boolean> {
	return new Promise<boolean>((resolve, reject) => {
		const repo = new GitHub({
			repo: OmnisharpRepo,
			token: null
		});
		
		repo.getReleases({ tag_name: OmnisharpVersion }, (err, releases) => {
			if (err) {
				return reject(err);
			}
			
			if (!releases.length) {
				return reject(new Error(`OmniSharp release ${OmnisharpVersion} not found.`));
			}
			
			if (!releases[0].assets.length) {
				return reject(new Error(`Omnisharp release ${OmnisharpVersion} asset not found.`));
			}
			
			repo.downloadAsset(releases[0].assets[0], (err, inStream) => {
				if (err) {
					return reject(err);
				}
				
				tmp.file((err, tmpPath, fd, cleanupCallback) => {
					if (err) {
						return reject(err);
					}
					
					const outStream = fs.createWriteStream(null, { fd: fd });
					outStream.once('error', err => reject(err));
					inStream.once('error', err => reject(err));
					
					outStream.once('finish', () => {
						// At this point, the file is finished downloading.
						
						const decompress = new Decompress()
							.src(tmpPath)
							.dest(getDefaultOmnisharpInstallLocation())
							.use(Decompress.targz())
							.use(Decompress.zip());
							
						decompress.run((err, files) => {
							if (err) {
								return reject(err);
							}
							
							resolve(true);
						});
					});
					
					inStream.pipe(outStream);
				});
			})
		});
	});
}

export function registerInstallCommand(server: OmnisharpServer): vscode.Disposable {
	return vscode.commands.registerCommand('omnisharp.install', () => {
		const item = {
			title: 'Yes',
			command() {
				downloadOmnisharp()
					.then(success => {
						if (success) {
							server.restart();
						}
					});
			}  
		};

		vscode.window.showInformationMessage('OmniSharp provides a richer C# editing experience. Download and install?', item)
			.then(selection => {
				if (selection) {
					selection.command();
				}
			});
	});
}