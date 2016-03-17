/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
 
'use strict';

import * as fs from 'fs-extra-promise';
import * as tmp from 'tmp';
import * as vfs from 'vinyl-fs';

const es = require('event-stream');
const  github = require('github-releases');

tmp.setGracefulCleanup();

export function downloadOmnisharp(version: string) {
    var result = es.through();
    
    function onError(err) {
        result.emit('error', err);
    }
    
    var repo = new github({
        repo: 'OmniSharp/omnisharp-roslyn',
        token: process.env['GITHUB_TOKEN']
    });
    
    repo.getReleases({ tag_name: version }, function (err, releases) {
        if (err) {
            return onError(err);
        }
        
        if (!releases.length) {
            return onError(new Error('Release not found'));
        }
        
        if (!releases[0].assets.length) {
            return onError(new Error('Assets not found'));
        }
        
        repo.downloadAsset(releases[0].assets[0], function (err, istream) {
            if (err) {
                return onError(err);
            }
            
            tmp.file(function (err, tmpPath, fd, cleanupCallback) {
                if (err) {
                    return onError(err);
                }
                
                var ostream = fs.createWriteStream(null, { fd: fd });
                ostream.once('error', onError);
                istream.once('error', onError);
                ostream.once('finish', function () {
                    vfs.src(tmpPath).pipe(result);
                });
                
                istream.pipe(ostream);
            });
        });
    });
    
    return result;
}
