# OptionsSchema
OptionsSchema.json defines the type for Launch/Attach options.

# GenerateOptionsSchema
If there are any modifications to the OptionsSchema.json file. Please run `npm run gulp generateOptionsSchema` at the repo root.
This will call GenerateOptionsSchema and update the package.json file.

### Important notes:

1. Any manual changes to package.json's object.contributes.debuggers[0].configurationAttributes will be
replaced by this generator.
2. This does **NOT** update the schema for csharp.unitTestDebuggingOptions. So if the schema change is something valuable in unit test debugging, consider updating that section of package.json (look for `"csharp.unitTestDebuggingOptions"`). The schema will work even if this step is omitted, but users will not get IntelliSense help when editing the new option if this step is skipped.


If there is any other type of options added in the future, you will need to modify the GenerateOptionsSchema function
to have it appear in package.json. It only adds launch and attach.
