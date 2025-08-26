The dotnet SDK resolver has issues locating SDKS with Snap installs.

One solution posted to the dotnet/sdk snap issue may resolve your issue - https://github.com/dotnet/sdk/issues/10403#issuecomment-621463370

> I was struggling with omnisharp not resolving the dotnet-sdk snap on 20.04 until I discovered that a simple
> 
> `ln -s /snap/dotnet-sdk/current/dotnet /usr/local/bin/dotnet`
> 
> did the trick. No need for msbuild path exports or an omnisharp json legacy resolver.