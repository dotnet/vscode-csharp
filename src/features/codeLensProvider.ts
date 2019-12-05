/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import * as vscode from 'vscode';
import { toLocation } from '../omnisharp/typeConversion';
import AbstractProvider from './abstractProvider';
import { OmniSharpServer } from '../omnisharp/server';
import { Options } from '../omnisharp/options';
import TestManager from './dotnetTest';
import OptionProvider from '../observers/OptionProvider';

import Structure = protocol.V2.Structure;
import SymbolKinds = protocol.V2.SymbolKinds;
import SymbolPropertyNames = protocol.V2.SymbolPropertyNames;
import SymbolRangeNames = protocol.V2.SymbolRangeNames;
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';

abstract class OmniSharpCodeLens extends vscode.CodeLens {
    constructor(
        range: protocol.V2.Range,
        public fileName: string) {

        super(new vscode.Range(
            range.Start.Line - 1, range.Start.Column - 1, range.End.Line - 1, range.End.Column - 1
        ));
    }
}

class ReferencesCodeLens extends OmniSharpCodeLens {
    constructor(
        range: protocol.V2.Range,
        fileName: string) {
        super(range, fileName);
    }
}

abstract class TestCodeLens extends OmniSharpCodeLens {
    constructor(
        range: protocol.V2.Range,
        fileName: string,
        public displayName: string,
        public isTestContainer: boolean,
        public testFramework: string,
        public testMethodNames: string[]) {

        super(range, fileName);
    }
}

class RunTestsCodeLens extends TestCodeLens {
    constructor(
        range: protocol.V2.Range,
        fileName: string,
        displayName: string,
        isTestContainer: boolean,
        testFramework: string,
        testMethodNames: string[]) {

        super(range, fileName, displayName, isTestContainer, testFramework, testMethodNames);
    }
}

class DebugTestsCodeLens extends TestCodeLens {
    constructor(
        range: protocol.V2.Range,
        fileName: string,
        displayName: string,
        isTestContainer: boolean,
        testFramework: string,
        testMethodNames: string[]) {

        super(range, fileName, displayName, isTestContainer, testFramework, testMethodNames);
    }
}

export default class OmniSharpCodeLensProvider extends AbstractProvider implements vscode.CodeLensProvider {

    constructor(server: OmniSharpServer, testManager: TestManager, private optionProvider: OptionProvider, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
    }

    async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
        const options = this.optionProvider.GetLatestOptions();
        if (!options.showReferencesCodeLens && !options.showTestsCodeLens) {
            return [];
        }

        try {
            const response = await serverUtils.codeStructure(this._server, { FileName: document.fileName }, token);
            if (response && response.Elements) {
                return createCodeLenses(response.Elements, document.fileName, options);
            }
        }
        catch (error) { }

        return [];
    }

    async resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): Promise<vscode.CodeLens> {
        if (codeLens instanceof ReferencesCodeLens) {
            return this.resolveReferencesCodeLens(codeLens, token);
        }
        else if (codeLens instanceof RunTestsCodeLens) {
            return this.resolveTestCodeLens(codeLens, 'Run Test', 'dotnet.test.run', 'Run All Tests', 'dotnet.classTests.run');
        }
        else if (codeLens instanceof DebugTestsCodeLens) {
            return this.resolveTestCodeLens(codeLens, 'Debug Test', 'dotnet.test.debug', 'Debug All Tests', 'dotnet.classTests.debug');
        }
    }

    private async resolveReferencesCodeLens(codeLens: ReferencesCodeLens, token: vscode.CancellationToken): Promise<vscode.CodeLens> {
        const request: protocol.FindUsagesRequest = {
            FileName: codeLens.fileName,
            Line: codeLens.range.start.line + 1, // OmniSharp is 1-based
            Column: codeLens.range.start.character + 1, // OmniSharp is 1-based
            OnlyThisFile: false,
            ExcludeDefinition: true
        };

        try {
            let result = await serverUtils.findUsages(this._server, request, token);
            if (!result || !result.QuickFixes) {
                return undefined;
            }

            const quickFixes = result.QuickFixes;
            const count = quickFixes.length;
            const locations = quickFixes.map(toLocation);
            
            // Allow language middlewares to re-map its edits if necessary.
            const remappedLocations = await this._languageMiddlewareFeature.remap("remapLocations", locations, token);

            codeLens.command = {
                title: count === 1 ? '1 reference' : `${count} references`,
                command: 'editor.action.showReferences',
                arguments: [vscode.Uri.file(request.FileName), codeLens.range.start, remappedLocations]
            };

            return codeLens;
        }
        catch (error) {
            return undefined;
        }
    }

    private async resolveTestCodeLens(codeLens: TestCodeLens, singularTitle: string, singularCommandName: string, pluralTitle: string, pluralCommandName: string): Promise<vscode.CodeLens> {
        if (!codeLens.isTestContainer) {
            // This is just a single test method, not a container.
            codeLens.command = {
                title: singularTitle,
                command: singularCommandName,
                arguments: [codeLens.testMethodNames[0], codeLens.fileName, codeLens.testFramework]
            };

            return codeLens;
        }

        let projectInfo: protocol.ProjectInformationResponse;
        try {
            projectInfo = await serverUtils.requestProjectInformation(this._server, { FileName: codeLens.fileName });
        }
        catch (error) {
            return undefined;
        }
            
        // We do not support running all tests on legacy projects.
        if (projectInfo.MsBuildProject && !projectInfo.DotNetProject) {
            codeLens.command = {
                title: pluralTitle,
                command: pluralCommandName,
                arguments: [codeLens.displayName, codeLens.testMethodNames, codeLens.fileName, codeLens.testFramework]
            };
        }

        return codeLens;
    }
}

function createCodeLenses(elements: Structure.CodeElement[], fileName: string, options: Options): vscode.CodeLens[] {
    let results: vscode.CodeLens[] = [];

    Structure.walkCodeElements(elements, element => {
        let codeLenses = createCodeLensesForElement(element, fileName, options);

        results.push(...codeLenses);
    });

    return results;
}

function createCodeLensesForElement(element: Structure.CodeElement, fileName: string, options: Options): vscode.CodeLens[] {
    let results: vscode.CodeLens[] = [];

    if (options.showReferencesCodeLens && isValidElementForReferencesCodeLens(element)) {
        let range = element.Ranges[SymbolRangeNames.Name];
        if (range) {
            results.push(new ReferencesCodeLens(range, fileName));
        }
    }

    if (options.showTestsCodeLens) {
        if (isValidMethodForTestCodeLens(element)) {
            let [testFramework, testMethodName] = getTestFrameworkAndMethodName(element);
            let range = element.Ranges[SymbolRangeNames.Name];

            if (range && testFramework && testMethodName) {
                results.push(new RunTestsCodeLens(range, fileName, element.DisplayName,/*isTestContainer*/ false, testFramework, [testMethodName]));
                results.push(new DebugTestsCodeLens(range, fileName, element.DisplayName,/*isTestContainer*/ false, testFramework, [testMethodName]));
            }
        }
        else if (isValidClassForTestCodeLens(element)) {
            // Note: We don't handle multiple test frameworks in the same class. The first test framework wins.
            let testFramework: string = null;
            let testMethodNames: string[] = [];
            let range = element.Ranges[SymbolRangeNames.Name];

            for (let childElement of element.Children) {
                let [childTestFramework, childTestMethodName] = getTestFrameworkAndMethodName(childElement);

                if (!testFramework && childTestFramework) {
                    testFramework = childTestFramework;
                    testMethodNames.push(childTestMethodName);
                }
                else if (testFramework && childTestFramework === testFramework) {
                    testMethodNames.push(childTestMethodName);
                }
            }

            results.push(new RunTestsCodeLens(range, fileName, element.DisplayName,/*isTestContainer*/ true, testFramework, testMethodNames));
            results.push(new DebugTestsCodeLens(range, fileName, element.DisplayName,/*isTestContainer*/ true, testFramework, testMethodNames));
        }
    }

    return results;
}

const filteredSymbolNames: { [name: string]: boolean } = {
    'Equals': true,
    'Finalize': true,
    'GetHashCode': true,
    'ToString': true
};

function isValidElementForReferencesCodeLens(element: Structure.CodeElement): boolean {
    if (element.Kind === SymbolKinds.Namespace) {
        return false;
    }

    if (element.Kind === SymbolKinds.Method && filteredSymbolNames[element.Name]) {
        return false;
    }

    return true;
}


function isValidClassForTestCodeLens(element: Structure.CodeElement): boolean {
    if (element.Kind != SymbolKinds.Class) {
        return false;
    }

    if (!element.Children) {
        return false;
    }

    return element.Children.find(isValidMethodForTestCodeLens) !== undefined;
}

function isValidMethodForTestCodeLens(element: Structure.CodeElement): boolean {
    if (element.Kind != SymbolKinds.Method) {
        return false;
    }

    if (!element.Properties ||
        !element.Properties[SymbolPropertyNames.TestFramework] ||
        !element.Properties[SymbolPropertyNames.TestMethodName]) {
        return false;
    }

    return true;
}

function getTestFrameworkAndMethodName(element: Structure.CodeElement): [string, string] {
    if (!element.Properties) {
        return [null, null];
    }

    const testFramework = element.Properties[SymbolPropertyNames.TestFramework];
    const testMethodName = element.Properties[SymbolPropertyNames.TestMethodName];

    return [testFramework, testMethodName];
}
