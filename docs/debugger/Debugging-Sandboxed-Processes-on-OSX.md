The debugger has basic support for attaching to processes that load CoreCLR in a sandbox. Note that this workflow is subject to change in the future.

To tell the debugger that your application is loaded in a sandbox, you need to drop a .json file next to your application's executable. It should have the same name as your application with an added `.coreclr-debug-config.json`. The content of this file is as follows:

```json
{
  "applicationGroupId" : "<value-here>" 
} 
```

Notes:
1. This will work in both Visual Studio and VS Code
2. Comments are NOT supported
3. The file must be UTF-8 encoded. A BOM is allowed but not required.