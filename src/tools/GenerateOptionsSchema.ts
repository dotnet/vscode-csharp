import * as fs from 'fs';
import * as os from 'os';

function AppendFieldsToObject(reference: any, obj: any) {

    // Make sure it is an object type
    if (typeof obj == 'object') {
        for (let referenceKey in reference) {
            // If key exists in original object and is an object. 
            if (obj.hasOwnProperty(referenceKey)) {
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
    let newDefault: any = {};

    for (let attrname in childDefault) {
        newDefault[attrname] = childDefault[attrname];
    }

    for (let attrname in parentDefault) {
        newDefault[attrname] = parentDefault[attrname];
    }

    return newDefault;
}

function UpdateDefaults(object: any, defaults: any) {
    if (defaults != null) {
        for (let key in object) {
            if (object[key].hasOwnProperty('type') && object[key].type === 'object' && object[key].properties !== null) {
                object[key].properties = UpdateDefaults(object[key].properties, MergeDefaults(defaults, object[key].default));
            } else if (key in defaults) {
                object[key].default = defaults[key];
            }
        }
    }

    return object;
}

function ReplaceReferences(definitions: any, objects: any) {
    for (let key in objects) {
        if (objects[key].hasOwnProperty('$ref')) {
            // $ref is formatted as "#/definitions/ObjectName"
            let referenceStringArray: string[] = objects[key]['$ref'].split('/');

            // Getting "ObjectName"
            let referenceName: string = referenceStringArray[referenceStringArray.length - 1];

            // Make sure reference has replaced its own $ref fields and hope there are no recursive references.
            definitions[referenceName] = ReplaceReferences(definitions, definitions[referenceName]);

            // Retrieve ObjectName from definitions. (TODO: Does not retrieve inner objects)
            // Need to deep copy, there are no functions in these objects.
            let reference: any = JSON.parse(JSON.stringify(definitions[referenceName]));

            objects[key] = AppendFieldsToObject(reference, objects[key]);

            // Remove $ref field
            delete objects[key]['$ref'];
        }

        // Recursively replace references if this object has properties. 
        if (objects[key].hasOwnProperty('type') && objects[key].type === 'object' && objects[key].properties !== null) {
            objects[key].properties = ReplaceReferences(definitions, objects[key].properties);
            objects[key].properties = UpdateDefaults(objects[key].properties, objects[key].default);
        }
    }

    return objects;
}

export function GenerateOptionsSchema() {
    let packageJSON: any = JSON.parse(fs.readFileSync('package.json').toString());
    let schemaJSON: any = JSON.parse(fs.readFileSync('src/tools/OptionsSchema.json').toString());

    schemaJSON.definitions = ReplaceReferences(schemaJSON.definitions, schemaJSON.definitions);

    // Hard Code adding in configurationAttributes launch and attach.
    // .NET Core
    packageJSON.contributes.debuggers[0].configurationAttributes.launch = schemaJSON.definitions.LaunchOptions;
    packageJSON.contributes.debuggers[0].configurationAttributes.attach = schemaJSON.definitions.AttachOptions;

    // Full .NET Framework
    packageJSON.contributes.debuggers[1].configurationAttributes.launch = schemaJSON.definitions.LaunchOptions;
    packageJSON.contributes.debuggers[1].configurationAttributes.attach = schemaJSON.definitions.AttachOptions;

    let content = JSON.stringify(packageJSON, null, 2);
    if (os.platform() === 'win32') {
        content = content.replace(/\n/gm, "\r\n");
    }
    fs.writeFileSync('package.json', content);
}
