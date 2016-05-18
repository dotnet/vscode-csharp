## C# for Visual Studio Code (powered by OmniSharp)

|Master|Dev|
|:--:|:--:|
|[![Master Build Status](https://travis-ci.org/OmniSharp/omnisharp-vscode.svg?branch=master)](https://travis-ci.org/OmniSharp/omnisharp-vscode)|[![Dev Build Status](https://travis-ci.org/OmniSharp/omnisharp-vscode.svg?branch=dev)](https://travis-ci.org/OmniSharp/omnisharp-vscode)|

This is a preview of C# support in Visual Studio code. It is designed to work well with [.NET Core 1.0](http://dotnet.github.io/). 
These new projects are based on project.json and the [.NET CLI](https://dotnet.github.io/getting-started/).

### Support for .csproj and Mono on OS X and Linux

Support for .csproj projects will be improved in future versions of this extension. For now, if you are targeting Mono scenarios (ex: Unity or Xamarin) we suggest instead installing the 'Built-in Omnisharp' extension. Note that the name of the OmniSharp extension is no longer correct - the extension is no longer built into VS Code.

Use the following steps to install the older OmniSharp extension for Mono support:

1. Install ASP.NET 5 RC1 (NOTE: Do **NOT** use RC2)
    * Windows: https://docs.asp.net/en/1.0.0-rc1/getting-started/installing-on-windows.html
    * OSX: https://docs.asp.net/en/1.0.0-rc1/getting-started/installing-on-mac.html. Follow the instructions for using Mono.
    * Linux: https://docs.asp.net/en/1.0.0-rc1/getting-started/installing-on-linux.html. Follow the instructions for using Mono.
2. Bring up the extension list in VS Code by opening the command pallet (F1 key) and type 'ext install'.
3. After VS Code has downloaded the extension list, type 'omnisharp' and select 'Built-in Omnisharp' from the list.
4. Open a C# file. If intellisense isn't working, open the output window (View->Toggle Output) and look at the 'OmniSharp Log'.

### Debugging
This version supports basic debugging capabilities.
See http://aka.ms/vscclrdebugger for details.

### Development

First install:
* Node.js (newer than 4.3.1)
* Npm (newer 2.14.12)

To **run and develop** do the following:

* Run `npm i`
* Open in Visual Studio Code (`code .`)
* *Optional:* run `tsc -w`, make code changes (on Windows, try `start node ".\node_modules\typescript\bin\tsc -w"`)
* Press F5 to debug

## License  
The Microsoft C# extension is subject to [these license terms](RuntimeLicenses/license.txt).  
The source code to this extension is available on [https://github.com/OmniSharp/omnisharp-vscode](https://github.com/OmniSharp/omnisharp-vscode) and licensed under the [MIT license](LICENSE.txt).  
