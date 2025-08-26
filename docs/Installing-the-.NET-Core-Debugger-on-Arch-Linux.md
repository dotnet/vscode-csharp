#### Instructions

.NET Core does not officially provide packages for use on Arch Linux. But many folks in the community have been successful in getting it to work. Here are the steps:

1: Find or install icu (International Components for Unicode library). The [icu52 package](https://aur.archlinux.org/packages/icu52/) is compatible with the Ubuntu 14.04 .NET Core, and the [icu57 package](https://aur.archlinux.org/packages/icu57/) is compatible with the Ubuntu 16.04 .NET Core. You can find the version you have installed with `ldconfig -p | grep libicuuc.so`.

2: In VS Code, Invoke `File->Preferences->Settings`.

3: Set `"csharp.fallbackDebuggerLinuxRuntimeId"` to either `"ubuntu.14.04-x64"` or `"ubuntu.16.04-x64"` depending on the result of the first step.

4: Restart VS Code and open a C# file.

5: The C# Extension will download its dependences. You will hopefully see that the download now succeeds and the debugger will run.

6: If you upgrade to a more recent version of the C# extension in the future, you should see that you setting is kept, and so things will just work.

#### Thanks

Thanks to all the folks in the community who contributed information to make this possible. Full details are in issue [#1323](https://github.com/OmniSharp/omnisharp-vscode/issues/1323).