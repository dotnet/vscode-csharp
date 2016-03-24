## C# for Visual Studio Code (powered by OmniSharp)

Master: [![Build Status](https://travis-ci.org/OmniSharp/omnisharp-vscode.svg?branch=master)](https://travis-ci.org/OmniSharp/omnisharp-vscode)
Dev: [![Build Status](https://travis-ci.org/OmniSharp/omnisharp-vscode.svg?branch=dev)](https://travis-ci.org/OmniSharp/omnisharp-vscode)

Don't install this extension unless you want to try an early version. 

This is a preview of C# support in Visual Studio code. It is designed to work well with the upcoming [.NET Core 1.0](http://dotnet.github.io/). 
These new projects are based on project.json and the [.NET CLI](https://dotnet.github.io/getting-started/).

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
