## C# for Visual Studio Code (powered by OmniSharp)

Don't install this extension unless you want to try an early version. 

This is a preview of C# support in Visual Studio code. It is designed to work well with upcoming [.NET Core 1.0]([link](http://dotnet.github.io/). 
These new projects are based on project.json and the [.NET CLI](https://dotnet.github.io/getting-started/).

For msbuild based projects, or ASP.NET Core 5.0 RC1 you still want to use the [omnisharp extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.omnisharp) instead.

### Debugging
This version supports basic debugging capabilities.
See http://aka.ms/vscclrdebugger for details.

### Development
To **run and develop** do the following:

* Run `npm i`
* Open in Visual Studio Code (`code .`)
* *Optional:* run `tsc -w`, make code changes (on Windows, try `start node ".\node_modules\typescript\bin\tsc -w"`)
* Press F5 to debug


## License  
The Microsoft C# extension is subject to [these license terms](RuntimeLicenses/license.txt).  
The source code to this extension is available on [https://github.com/OmniSharp/omnisharp-vscode](https://github.com/OmniSharp/omnisharp-vscode) and licensed under the [MIT license](LICENSE.txt).  
