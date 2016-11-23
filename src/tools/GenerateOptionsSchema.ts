import * as fs from 'fs';

function AppendFieldsToObject(reference, obj) {
    
    if (typeof obj == 'object') {
        for (var referenceKey in reference) {
            // If key exists in original object
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

function MergeDefaults(parentDefault, childDefault) {
    let newDefault = {};

    for (var attrname in childDefault) { 
        newDefault[attrname] = childDefault[attrname]; 
    }

    for (var attrname in parentDefault) { 
        newDefault[attrname] = parentDefault[attrname]; 
    }

    return newDefault;
}

function UpdateDefaults(object, defaults) {
    if (defaults != null) {
        for (var key in object) {
            if (object[key].hasOwnProperty('type') && object[key].type == "object" && object[key].properties != null) {
                object[key].properties = UpdateDefaults(object[key].properties, MergeDefaults(defaults, object[key].default));
            } else if (key in defaults) {
                object[key].default = defaults[key];
            }
        }
    }

    return object;
}

function ReplaceReferences(definitions, objects) {	
	for (var key in objects) {
		if (objects[key].hasOwnProperty('$ref')) {
            // $ref is formatted as "#/definitions/ObjectName"
			var referenceStringArray = objects[key]['$ref'].split('/');

            // Getting "ObjectName"
			var referenceName = referenceStringArray[referenceStringArray.length -1];

			// Make sure reference has replaced its own $ref fields and hope there are no recursive references.
			definitions[referenceName] = ReplaceReferences(definitions, definitions[referenceName]);

            // Retrieve ObjectName from definitions. (TODO: Does not retrieve inner objects)
            // Need to deep copy, there are no functions in these objects.
			var reference = JSON.parse(JSON.stringify(definitions[referenceName]));

			objects[key] = AppendFieldsToObject(reference, objects[key]);

			// Remove $ref field
			delete objects[key]['$ref']
		}

		if (objects[key].hasOwnProperty('type') && objects[key].type == "object" && objects[key].properties != null){
			objects[key].properties = ReplaceReferences(definitions, objects[key].properties);  
            objects[key].properties = UpdateDefaults(objects[key].properties, objects[key].default);
		}
	}

	return objects
}

export function GenerateOptionsSchema() {
    let packageJSON = JSON.parse(fs.readFileSync('package.json').toString());
    let schemaJSON = JSON.parse(fs.readFileSync('src/tools/OptionsSchema.json').toString());

	schemaJSON.definitions = ReplaceReferences(schemaJSON.definitions, schemaJSON.definitions);

	packageJSON.contributes.debuggers[0].configurationAttributes.launch = schemaJSON.definitions.LaunchOptions;
	packageJSON.contributes.debuggers[0].configurationAttributes.attach = schemaJSON.definitions.AttachOptions;

	fs.writeFileSync('package.json', JSON.stringify(packageJSON, null, 2));
}
