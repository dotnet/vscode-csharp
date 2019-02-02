#npm i
rm .\csharp-1.18.0-beta6.vsix
gulp vsix:release:package
gulp vsix:release:unpackage
code --uninstall-extension csharp-1.18.0-beta6.vsix
rm C:\Users\akagarw\.vscode\extensions\ms-vscode.csharp-1.18.0-beta6
code --install-extension ./csharp-1.18.0-beta6.vsix
code C:\Users\akagarw\Desktop\CodeSamples\test
#gulp test:integration:singleCsproj --codeExtensionPath ./vsix/extension
