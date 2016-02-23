'use strict';

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

var _coreClrDebugDir: string;
var _debugAdapterDir: string;
var _channel: vscode.OutputChannel;

export function installCoreClrDebug(context: vscode.ExtensionContext) {
    _coreClrDebugDir = path.join(context.extensionPath, 'coreclr-debug');
    _debugAdapterDir = path.join(_coreClrDebugDir, 'debugAdapters');
    _channel = vscode.window.createOutputChannel('coreclr-debug');
    
    if (existsSync(_debugAdapterDir)) {
        console.log('.NET Core Debugger tools already installed');
        return;
    }

    _channel.appendLine("Downloading and configuring the .NET Core Debugger...");
    _channel.show(vscode.ViewColumn.Three);
    
    spawnChildProcess('dotnet', ['restore'], _channel, _coreClrDebugDir)
    .then(function() {
        return spawnChildProcess('dotnet', ['publish', '-o', _debugAdapterDir], _channel, _coreClrDebugDir);
    }).then(function() {
        var promises: Promise<void>[] = [];

        promises.push(renameDummyEntrypoint());
        promises = promises.concat(copyFiles(context));
        promises.push(removeLibCoreClrTraceProvider());

        return Promise.all(promises);
    }).then(function() {
        _channel.appendLine('Succesfully installed .NET Core Debugger.');
    })
    .catch(function(error) {
        _channel.appendLine('Error while installing .NET Core Debugger.');
        console.log(error);
    });
}

function renameDummyEntrypoint() : Promise<void> {
    var src = path.join(_debugAdapterDir, 'dummy');
    var dest = path.join(_debugAdapterDir, 'OpenDebugAD7');

    src += getPlatformExeExtension();
    dest += getPlatformExeExtension();

    var promise = new Promise<void>(function(resolve, reject) {
       fs.rename(src, dest, function(err) {
           if (err) {
               reject(err);
           } else {
               resolve();
           }
       });
    });
    
    return promise;
}

function copyFiles(context: vscode.ExtensionContext): Promise<void>[] {
    // TODO: This method and all invocations can be removed once
    // the dotnet cli tools support nuget packages with 
    // contentFiles metadata
    // https://docs.nuget.org/create/nuspec-reference#contentfiles-with-visual-studio-2015-update-1-and-later

    var projectJson = JSON.parse(fs.readFileSync(path.join(_coreClrDebugDir, 'project.json')).toString());

    var clrdbgId = 'Microsoft.VisualStudio.clrdbg';
    var clrdbgVersion: string = projectJson.dependencies[clrdbgId];

    var MIEngineId = 'Microsoft.VisualStudio.clrdbg.MIEngine';
    var MIEngineVersion: string = projectJson.dependencies[MIEngineId];

    var destRoot: string = _debugAdapterDir;

    var packagesRoot = getPackagesRoot();
    var clrdbgRoot = path.join(packagesRoot, clrdbgId, clrdbgVersion);
    var MIEngineRoot = path.join(packagesRoot, MIEngineId, MIEngineVersion);

    var promises: Promise<void>[] = [];

    function copyClrdbg(src: string, dest?: string) { promises.push(copy(path.join(clrdbgRoot, src), dest)); }
    function copyMIEngine(src: string, dest?: string) { promises.push(copy(path.join(MIEngineRoot, src), dest)); }

    copyClrdbg(path.join('1033', 'clrdbg.resources.dll'), '1033');
    copyClrdbg(path.join('1033', 'vsdebugeng.impl.resources.dll'), '1033');
    copyClrdbg(path.join('1033', 'VSDebugUI.dll'), '1033');
    copyClrdbg('libclrdbg.vsdconfig');
    copyClrdbg('Microsoft.CodeAnalysis.CSharp.ExpressionEvaluator.ExpressionCompiler.vsdconfig');
    copyClrdbg('Microsoft.CodeAnalysis.CSharp.ExpressionEvaluator.ResultProvider.vsdconfig');
    copyClrdbg('version.txt');
    copyClrdbg('vsdebugeng.impl.vsdconfig');
    copyClrdbg('vsdebugeng.manimpl.vsdconfig');

    copyMIEngine('coreclr.ad7Engine.json');

    return promises;
}

function removeLibCoreClrTraceProvider() : Promise<void>
{
    var filePath = path.join(_debugAdapterDir, 'libcoreclrtraceptprovider' + getPlatformLibExtension());

    if (!existsSync(filePath)) {
        return Promise.resolve();
    } else {
        return new Promise<void>(function(resolve, reject) {
            fs.unlink(filePath, function(err) {
                if (err) {
                    reject(err);
                } else {
                    _channel.appendLine('Succesfully deleted ' + filePath)
                    resolve();
                }
            });
        });
    }
}

function copy(src: string, dest?: string) : Promise<void> {
    var destination = _debugAdapterDir;
    if (dest) {
        destination = path.join(destination, dest);
    }

    return new Promise<void>(function(resolve, reject) {

        if (!existsSync(destination)) {
            fs.mkdirSync(destination);
        }

        var destFile = path.join(destination, path.basename(src))

        var sourceStream = fs.createReadStream(src);
        sourceStream.on('error', reject);
        var destStream = fs.createWriteStream(destFile);
        destStream.on('error', reject);
        destStream.on('finish', function() {
            _channel.appendLine('Succesfully copied ' + src + ' to ' + destination);
            resolve();
        });
        sourceStream.pipe(destStream);
    });
}

// TODO: not currently used but may need to be used for updating.
// TODO: wrap this in try catch for i/o errors
function deleteDirectoryRecursivelySync(dirPath: string) {
    if (existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach(function(file, index) {
            var currentPath = path.join(dirPath, file);
            if (fs.lstatSync(currentPath).isDirectory()) {
                deleteDirectoryRecursivelySync(currentPath);
            }
            else {
                fs.unlinkSync(currentPath);
            }
        });
        fs.rmdirSync(dirPath);
    }
}

function existsSync(path: string) : boolean {
    try {
        fs.accessSync(path, fs.F_OK);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') {
            return false;
        } else {
            throw err;
        }
    }
}

function getPackagesRoot() : string {
    var homedir = getHomeDir();
    return path.join(homedir, '.nuget', 'packages');
}

function getHomeDir() : string {
    switch (process.platform) {
        case "win32":
            return process.env['USERPROFILE'];
        case "darwin":
        case "linux":
            return process.env['HOME'];
        default:
            throw new Error('Unsupported platform: ' + process.platform);
    }
}

function getPlatformExeExtension() : string {
    if (process.platform === 'win32') {
        return '.exe'
    }

    return '';
}

function getPlatformLibExtension() : string {
    switch (process.platform) {
        case 'win32':
            return '.dll';
        case 'darwin':
            return '.dylib';
        case 'linux':
            return '.so';
        default:
            throw Error('Unsupported platform ' + process.platform);
    }
}

function spawnChildProcess(process: string, args: string[], channel: vscode.OutputChannel, workingDirectory: string) : Promise<void> {
    var promise = new Promise<void>( function (resolve, reject) {
        const child = child_process.spawn(process, args, {cwd: workingDirectory});

        child.stdout.on('data', (data) => {
            channel.append(`${data}`);
        });

        child.stderr.on('data', (data) => {
            channel.appendLine(`Error: ${data}`);
        });

        child.on('close', (code: number) => {
            if (code != 0) {
                channel.appendLine(`${process} exited with error code ${code}`);
                reject(new Error(code.toString()));    
            }
            else {
                resolve();
            }
        });
    });

    return promise;
}