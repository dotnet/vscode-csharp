import { should, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { Logger } from '../src/logger';
import { NuGetClient, PackageSource } from '../src/nuget';
import * as vscode from 'vscode';

suite("Resolve package refs and versions from NuGet", () => {
    let logger: Logger;

    suiteSetup(() => {
        should();
        use(chaiAsPromised);
        let channel: vscode.OutputChannel = vscode.window.createOutputChannel("test");
        logger = new Logger(() => channel.hide());
    });

    suite('NuGetClient', () => {

        test('Read activePackageSources from NuGet.config', () => {
            let nugetOrg = { source: 'nuget.org', indexUrl: 'https://api.nuget.org/v3/index.json' };
            let configXml = '<?xml version="1.0" encoding="utf-8"?> \
<configuration> \
  <packageRestore> \
    <add key="enabled" value="True" /> \
    <add key="automatic" value="True" /> \
  </packageRestore> \
  <packageSources> \
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" /> \
    <add key="nuget.org" value="https://www.nuget.org/api/v2/" /> \
    <add key="dotnetcore on myget" value="https://dotnet.myget.org/F/dotnet-core/api/v2/" /> \
  </packageSources> \
  <disabledPackageSources /> \
  <activePackageSource> \
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" /> \
    <add key="dotnetcore on myget" value="https://dotnet.myget.org/F/dotnet-core/api/v2/" /> \
  </activePackageSource> \
</configuration>';
            let target = new NuGetClient(configXml, logger);
            let p = target.UpdatePackageSourcesFromConfig().then((result) => {
                result.should.be.true;
                target.PackageSources.length.should.equal(2);
                target.PackageSources.should.contain(nugetOrg);
            });
            return p.should.eventually.be.fulfilled;
        });

        test('Default to nuget.org V3 with no config or package sources available', () => {
            let nugetOrg = {source: 'nuget.org', indexUrl: 'https://api.nuget.org/v3/index.json'};
            let target = new NuGetClient('', logger);
            let p = target.UpdatePackageSourcesFromConfig().then((result) => {
                result.should.be.true;
                target.PackageSources.length.should.equal(1);
                target.PackageSources[0].should.deep.equal(nugetOrg);
            });
            return p.should.eventually.be.fulfilled;
        });

        test('Update NuGet services for package sources', () => {
            let autoCompleteService = 'https://api-v2v3search-0.nuget.org/autocomplete';
            let packageRegistrationService = 'https://api.nuget.org/v3-flatcontainer/';
            let target = new NuGetClient('', logger);
            let packageSource: PackageSource = { source: 'nuget.org', indexUrl: 'https://api.nuget.org/v3/index.json' };
            let p = target.UpdateNuGetService(packageSource).then((result) => {
                result.should.be.true;
                target.NugetServices[packageSource.source].autoCompleteService.should.contain(autoCompleteService);
                target.NugetServices[packageSource.source].packageRegistrationService.should.equal(packageRegistrationService);
            });
            return p.should.eventually.be.fulfilled;
        });

        test('Retrieve package ids for partially given packageId', () => {
            let packageSource: PackageSource = { source: 'nuget.org', indexUrl: 'https://api.nuget.org/v3/index.json' };
            let target = new NuGetClient('', logger);
            return target.UpdateNuGetService(packageSource).then(() => {
                let p = target.FindPackagesByPartialId('newtonsoft');
                p.should.eventually.have.length.greaterThan(1);
                p.should.eventually.contain('Newtonsoft.Json');
            }).should.eventually.be.fulfilled;
        });

        test('Don\'t call out to the package source for an empty package id');

        test('Retrieve all version numbers for the selected package');

        test('Retrieve version numbers for partially given version number');
    });

    suite('CompletionItemProvider', () => {
        test('Provide suggestions for partial packageId');

        test('Provide suggestions for version number of given package');

    });
});