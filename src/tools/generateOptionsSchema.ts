/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as os from 'os';

function AppendFieldsToObject(reference: any, obj: any) {
    // Make sure it is an object type
    if (typeof obj == 'object') {
        for (const referenceKey in reference) {
            // If key exists in original object and is an object.
            if (Object.prototype.hasOwnProperty.call(obj, referenceKey)) {
                obj[referenceKey] = AppendFieldsToObject(reference[referenceKey], obj[referenceKey]);
            } else {
                // Does not exist in current object context
                obj[referenceKey] = reference[referenceKey];
            }
        }
    }

    return obj;
}

// Combines two object's fields, giving the parentDefault a higher precedence.
function MergeDefaults(parentDefault: any, childDefault: any) {
    const newDefault: any = {};

    for (const attrname in childDefault) {
        newDefault[attrname] = childDefault[attrname];
    }

    for (const attrname in parentDefault) {
        newDefault[attrname] = parentDefault[attrname];
    }

    return newDefault;
}

function UpdateDefaults(object: any, defaults: any) {
    if (defaults != null) {
        for (const key in object) {
            if (
                Object.prototype.hasOwnProperty.call(object[key], 'type') &&
                object[key].type === 'object' &&
                object[key].properties !== null
            ) {
                object[key].properties = UpdateDefaults(
                    object[key].properties,
                    MergeDefaults(defaults, object[key].default)
                );
            } else if (key in defaults) {
                object[key].default = defaults[key];
            }
        }
    }

    return object;
}

function ReplaceReferences(definitions: any, objects: any) {
    for (const key in objects) {
        if (Object.prototype.hasOwnProperty.call(objects[key], '$ref')) {
            // $ref is formatted as "#/definitions/ObjectName"
            const referenceStringArray: string[] = objects[key]['$ref'].split('/');

            // Getting "ObjectName"
            const referenceName: string = referenceStringArray[referenceStringArray.length - 1];

            // Make sure reference has replaced its own $ref fields and hope there are no recursive references.
            definitions[referenceName] = ReplaceReferences(definitions, definitions[referenceName]);

            // Retrieve ObjectName from definitions. (TODO: Does not retrieve inner objects)
            // Need to deep copy, there are no functions in these objects.
            const reference: any = JSON.parse(JSON.stringify(definitions[referenceName]));

            objects[key] = AppendFieldsToObject(reference, objects[key]);

            // Remove $ref field
            delete objects[key]['$ref'];
        }

        // Recursively replace references if this object has properties.
        if (
            Object.prototype.hasOwnProperty.call(objects[key], 'type') &&
            objects[key].type === 'object' &&
            objects[key].properties !== null
        ) {
            objects[key].properties = ReplaceReferences(definitions, objects[key].properties);
            objects[key].properties = UpdateDefaults(objects[key].properties, objects[key].default);
        }
    }

    return objects;
}

function mergeReferences(baseDefinitions: any, additionalDefinitions: any): void {
    for (const key in additionalDefinitions) {
        if (baseDefinitions[key]) {
            throw `Error: '${key}' defined in multiple schema files.`;
        }
        baseDefinitions[key] = additionalDefinitions[key];
    }
}

function createContributesSettingsForDebugOptions(
    path: string,
    options: any,
    ignoreKeys: Set<string>,
    outProperties: any
) {
    const optionKeys = Object.keys(options);
    for (const key of optionKeys) {
        if (ignoreKeys.has(key)) {
            continue;
        }
        const newOptionKey = path + '.' + key;
        const currentProperty: any = options[key];

        // See https://code.visualstudio.com/api/references/contribution-points#contributes.configuration for supported settings UI.
        if (
            currentProperty.type == 'boolean' ||
            currentProperty.type == 'string' ||
            (currentProperty.type == 'object' && currentProperty.additionalProperties != null) || // map type
            (currentProperty.type == 'array' && currentProperty.items != null) // array type
        ) {
            outProperties[newOptionKey] = { ...currentProperty }; // Create a deep copy
            if (currentProperty.settingsDescription) {
                outProperties[newOptionKey].markdownDescription = currentProperty.settingsDescription;
                delete outProperties[newOptionKey].settingsDescription;
            }
        }
        // Recursively create a suboption path.
        // E.g. csharp.debug.<object>.<propertykey>....
        else if (currentProperty.type == 'object') {
            createContributesSettingsForDebugOptions(
                newOptionKey,
                currentProperty.properties,
                new Set<string>(),
                outProperties
            );
        } else {
            throw 'Unknown option type';
        }
    }
}

// Generates an array of comments for the localization team depending on whats included in the input (description) string.
function generateCommentArrayForDescription(description: string): string[] {
    const comments: string[] = [];

    // If the description contains `, its most likely contains markdown that should not be translated.
    if (description.includes('`')) {
        comments.push(
            'Markdown text between `` should not be translated or localized (they represent literal text) and the capitalization, spacing, and punctuation (including the ``) should not be altered.'
        );
    }

    // If the description contains '\u200b', it is used to prevent vscode from rendering a URL.
    if (description.includes('\u200b')) {
        comments.push(
            "We use '\u200b' (unicode zero-length space character) to break VS Code's URL detection regex for URLs that are examples. Please do not translate or localized the URL."
        );
    }

    return comments;
}

// This method will create a key in keyToLocString for the prop strings.
function generateLocForProperty(key: string, prop: any, keyToLocString: any): void {
    if (prop.description) {
        const descriptionKey = `${key}.description`;
        if (!keyToLocString[descriptionKey]) {
            const comments: string[] = generateCommentArrayForDescription(prop.description);
            if (comments.length > 0) {
                keyToLocString[descriptionKey] = {
                    message: prop.description,
                    comment: comments,
                };
            } else {
                keyToLocString[descriptionKey] = prop.description;
            }
        }
        prop.description = `%${descriptionKey}%`;
    }

    if (prop.markdownDescription) {
        const markdownDescriptionKey = `${key}.markdownDescription`;
        if (!keyToLocString[markdownDescriptionKey]) {
            const comments: string[] = generateCommentArrayForDescription(prop.markdownDescription);
            if (comments.length > 0) {
                keyToLocString[markdownDescriptionKey] = {
                    message: prop.markdownDescription,
                    comment: comments,
                };
            } else {
                keyToLocString[markdownDescriptionKey] = prop.markdownDescription;
            }
        }
        prop.markdownDescription = `%${markdownDescriptionKey}%`;
    }

    if (prop.settingsDescription) {
        const settingsDescriptionKey = `${key}.settingsDescription`;
        if (!keyToLocString[settingsDescriptionKey]) {
            const comments: string[] = generateCommentArrayForDescription(prop.settingsDescription);
            if (comments.length > 0) {
                keyToLocString[settingsDescriptionKey] = {
                    message: prop.settingsDescription,
                    comment: comments,
                };
            } else {
                keyToLocString[settingsDescriptionKey] = prop.settingsDescription;
            }
        }
        prop.settingsDescription = `%${settingsDescriptionKey}%`;
    }

    if (prop.deprecationMessage) {
        const descriptionKey = `${key}.deprecationMessage`;
        if (!keyToLocString[descriptionKey]) {
            const comments: string[] = generateCommentArrayForDescription(prop.deprecationMessage);
            if (comments.length > 0) {
                keyToLocString[descriptionKey] = {
                    message: prop.deprecationMessage,
                    comment: comments,
                };
            } else {
                keyToLocString[descriptionKey] = prop.deprecationMessage;
            }
        }
        prop.deprecationMessage = `%${descriptionKey}%`;
    }

    if (prop.enum && prop.enumDescriptions) {
        for (let i = 0; i < prop.enum.length; i++) {
            const enumName = prop.enum[i];
            const enumDescription = prop.enumDescriptions[i];
            const newEnumKey = key + '.' + enumName + '.enumDescription';
            if (!keyToLocString[newEnumKey]) {
                keyToLocString[newEnumKey] = enumDescription;
            }
            prop.enumDescriptions[i] = `%${newEnumKey}%`;
        }
    }
}

function convertStringsToLocalizeKeys(path: string, options: any, keyToLocString: any) {
    const optionKeys = Object.keys(options);
    for (const key of optionKeys) {
        const newOptionKey = path + '.' + key;
        const currentProperty: any = options[key];

        generateLocForProperty(newOptionKey, currentProperty, keyToLocString);

        // Recursively through object properties
        if (currentProperty.type == 'object' && currentProperty.properties) {
            convertStringsToLocalizeKeys(newOptionKey, currentProperty.properties, keyToLocString);
        }

        if (currentProperty.anyOf) {
            for (let i = 0; i < currentProperty.anyOf.length; i++) {
                generateLocForProperty(`${newOptionKey}.${i}`, currentProperty.anyOf[i], keyToLocString);
            }
        }

        if (currentProperty.additionalItems) {
            convertStringsToLocalizeKeys(
                newOptionKey + '.additionalItems',
                currentProperty.additionalItems.properties,
                keyToLocString
            );
        }
    }
}

function writeToFile(objToWrite: any, filename: string) {
    let content = JSON.stringify(objToWrite, null, 2);
    if (os.platform() === 'win32') {
        content = content.replace(/\n/gm, '\r\n');
    }

    // We use '\u200b' (unicode zero-length space character) to break VS Code's URL detection regex for URLs that are examples. This process will
    // convert that from the readable espace sequence, to just an invisible character. Convert it back to the visible espace sequence.
    content = content.replace(/\u200b/gm, '\\u200b');

    fs.writeFileSync(filename, content);
}

export function GenerateOptionsSchema() {
    const packageNlsJSON: any = JSON.parse(fs.readFileSync('package.nls.json').toString());
    const packageJSON: any = JSON.parse(fs.readFileSync('package.json').toString());
    const schemaJSON: any = JSON.parse(fs.readFileSync('src/tools/OptionsSchema.json').toString());
    const symbolSettingsJSON: any = JSON.parse(fs.readFileSync('src/tools/VSSymbolSettings.json').toString());
    mergeReferences(schemaJSON.definitions, symbolSettingsJSON.definitions);

    schemaJSON.definitions = ReplaceReferences(schemaJSON.definitions, schemaJSON.definitions);

    // #region Generate package.nls.json keys/values

    // Delete old generated loc keys
    const originalLocKeys = Object.keys(packageNlsJSON).filter((x) => x.startsWith('generateOptionsSchema'));
    for (const key of originalLocKeys) {
        delete packageNlsJSON[key];
    }

    // Generate keys for package.nls.json and its associated strings.

    const keyToLocString: any = {};
    convertStringsToLocalizeKeys(
        'generateOptionsSchema',
        schemaJSON.definitions.LaunchOptions.properties,
        keyToLocString
    );
    convertStringsToLocalizeKeys(
        'generateOptionsSchema',
        schemaJSON.definitions.AttachOptions.properties,
        keyToLocString
    );

    // Override existing package.nls.json key/values with ones from OptionsSchema.
    Object.assign(packageNlsJSON, keyToLocString);

    writeToFile(packageNlsJSON, 'package.nls.json');

    // #endregion

    // Hard Code adding in configurationAttributes launch and attach.
    // .NET Core
    packageJSON.contributes.debuggers[0].configurationAttributes.launch = schemaJSON.definitions.LaunchOptions;
    packageJSON.contributes.debuggers[0].configurationAttributes.attach = schemaJSON.definitions.AttachOptions;

    // Full .NET Framework
    packageJSON.contributes.debuggers[1].configurationAttributes.launch = schemaJSON.definitions.LaunchOptions;
    packageJSON.contributes.debuggers[1].configurationAttributes.attach = schemaJSON.definitions.AttachOptions;

    // Make a copy of the options for unit test debugging
    const unitTestDebuggingOptions = JSON.parse(JSON.stringify(schemaJSON.definitions.AttachOptions.properties));
    // Remove the options we don't want
    delete unitTestDebuggingOptions.processName;
    delete unitTestDebuggingOptions.processId;
    delete unitTestDebuggingOptions.pipeTransport;

    // Remove diagnostic log logging options -- these should be set using the global option
    const allowedLoggingOptions = ['exceptions', 'moduleLoad', 'programOutput', 'threadExit', 'processExit'];
    const diagnosticLogOptions = Object.keys(unitTestDebuggingOptions.logging.properties).filter((x) => {
        if (allowedLoggingOptions.indexOf(x) >= 0) {
            return false;
        }
        return true;
    });
    for (const key of diagnosticLogOptions) {
        delete unitTestDebuggingOptions.logging.properties[key];
    }

    // Add the additional options we do want
    unitTestDebuggingOptions['type'] = {
        type: 'string',
        enum: ['coreclr', 'clr'],
        description:
            "Type type of code to debug. Can be either 'coreclr' for .NET Core debugging, or 'clr' for Desktop .NET Framework. 'clr' only works on Windows as the Desktop framework is Windows-only.",
        default: 'coreclr',
    };
    unitTestDebuggingOptions['debugServer'] = {
        type: 'number',
        description:
            'For debug extension development only: if a port is specified VS Code tries to connect to a debug adapter running in server mode',
        default: 4711,
    };
    packageJSON.contributes.configuration[1].properties['dotnet.unitTestDebuggingOptions'].properties =
        unitTestDebuggingOptions;

    // #region Generate package.json settings

    // Delete old debug options
    const originalContributeDebugKeys = Object.keys(packageJSON.contributes.configuration[1].properties).filter((x) =>
        x.startsWith('csharp.debug')
    );
    for (const key of originalContributeDebugKeys) {
        delete packageJSON.contributes.configuration[1].properties[key];
    }

    // Remove the options that should not be shown in the settings editor.
    const ignoreOptions: Set<string> = new Set<string>([
        'program',
        'cwd',
        'args',
        'targetArchitecture',
        'launchSettingsFilePath',
        'launchSettingsProfile',
        'externalConsole',
        'pipeTransport',
        'launchBrowser',
        'sourceLinkOptions',
        'env',
        'envFile',
        'targetOutputLogPath',
        'checkForDevCert',
    ]);
    // Using LaunchOptions as it is a superset of AttachOptions
    createContributesSettingsForDebugOptions(
        'csharp.debug',
        schemaJSON.definitions.LaunchOptions.properties,
        ignoreOptions,
        packageJSON.contributes.configuration[1].properties
    );

    // #endregion

    // Write package.json and package.nls.json to disk
    writeToFile(packageJSON, 'package.json');
}
