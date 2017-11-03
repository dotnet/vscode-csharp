/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { provideBuildTask } from '../../src/taskProvider';
import { should } from 'chai';
const chai = require('chai');

suite("Create VSCode Tasks", () => {
    suite("Build Tasks", () => {
        let projectIdentifier = "bar";
        let projectPath = "/users/developer/code/foo/bar.csproj";
        let task = provideBuildTask(projectIdentifier, projectPath);
    
        test("type should equal `dotnet`", () => {
            task.definition.type.should.equal('dotnet', 'because that is defined in package.json');
        });
        
        test("source should equal 'dotnet'", () => {
            task.source.should.equal(`dotnet`, "because VS Code will list the task as '{task.source}: {task.name}'");
        });
    
        test("name should equal 'build {projectIdentifier}'", () => {
            task.name.should.equal(`build ${projectIdentifier}`, "because VS Code will list the task as '{task.source}: {task.name}'");
        });
        
        test("source should be 'dotnet'", () => {
            task.problemMatchers.should.include("$msCompile", "because build tasks produce msCompile output.")
        });
    });

    suiteSetup(() => {
        should();
    })
});