import { should, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs';
import * as path from 'path';
import * as nock from 'nock';

import { Logger } from '../src/logger';
import { NuGetClient, PackageSource } from '../src/nuget';
import * as vscode from 'vscode';

suite("Resolve package refs and versions from NuGet", () => {
    let logger: Logger;

    suiteSetup(() => {
        // chai.
        should();
        use(chaiAsPromised);

        let channel: vscode.OutputChannel = vscode.window.createOutputChannel("test");
        logger = new Logger(() => channel.hide());
        nock.disableNetConnect();
    });

    suiteTeardown(() => nock.enableNetConnect());

    suite('NuGetClient', () => {
        setup(() => {
            let indexJson = path.join(__dirname, 'data', 'PackageSourceIndex.json');
            nock('https://api.nuget.org')
                .get('/v3/index.json')
                .replyWithFile(200, indexJson,{ 'Content-Type': 'application/ld+json'});
        });

        test('Read activePackageSources from NuGet.config', async () => {
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

            let result = await target.UpdatePackageSourcesFromConfig();

            result.should.be.true;
            target.PackageSources.length.should.equal(2);
            target.PackageSources.should.contain(nugetOrg);
        });

        test('Default to nuget.org V3 with no config or package sources available', async () => {
            let nugetOrg = {source: 'nuget.org', indexUrl: 'https://api.nuget.org/v3/index.json'};
            let target = new NuGetClient('', logger);
            let result = await target.UpdatePackageSourcesFromConfig();

            result.should.be.true;

            target.PackageSources.length.should.equal(1);
            target.PackageSources[0].should.deep.equal(nugetOrg);
        });

        test('Update NuGet services for package sources', async () => {
            let autoCompleteService = 'https://api-v2v3search-0.nuget.org/autocomplete';
            let packageRegistrationService = 'https://api.nuget.org/v3-flatcontainer/';
            let target = new NuGetClient('', logger);
            let packageSource: PackageSource = { source: 'nuget.org', indexUrl: 'https://api.nuget.org/v3/index.json' };

            let result = await target.UpdateNuGetService(packageSource);

            result.should.be.true;
            target.NugetServices[packageSource.source].autoCompleteService.should.contain(autoCompleteService);
            target.NugetServices[packageSource.source].packageRegistrationService.should.equal(packageRegistrationService);
        });

        test('Retrieve package ids for partially given packageId', async () => {
            let partialId = 'newtonsoft';
            nock('https://api-v2v3search-0.nuget.org')
                .get('/autocomplete?q=' + partialId + '&take=20')
                .replyWithFile(200, path.join(__dirname, 'data', 'AutoCompleteResponsePartialId.json'));
            let target = new NuGetClient('', logger);
            target.PackageSources = [{ source: 'nuget.org', indexUrl: '' }];
            target.NugetServices['nuget.org'] = { autoCompleteService: ['https://api-v2v3search-0.nuget.org/autocomplete'], packageRegistrationService: '' };

            let p = target.FindPackagesByPartialId(partialId);

            p.should.eventually.be.fulfilled;
            p.should.eventually.have.length.greaterThan(1);
            p.should.eventually.not.have.length.greaterThan(20);
            return p.should.eventually.contain('Newtonsoft.Json');
        });

        test('Limit the number of responses for an empty package id', async () => {
            nock('https://api-v2v3search-0.nuget.org')
                .get('/autocomplete?take=10')
                .replyWithFile(200, path.join(__dirname, 'data', 'AutoCompleteResponseNoId.json'));
            let target = new NuGetClient('', logger);
            target.PackageSources = [{ source: 'nuget.org', indexUrl: '' }];
            target.NugetServices['nuget.org'] = { autoCompleteService: ['https://api-v2v3search-0.nuget.org/autocomplete'], packageRegistrationService: '' };

            let p = target.FindPackagesByPartialId('', 10);

            p.should.eventually.be.fulfilled;
            return p.should.eventually.have.length(10);
        });

        test('Retrieve all version numbers for the selected package', async () => {
            let packageId = 'newtonsoft.json';
            nock('https://api.nuget.org')
                .get('/v3-flatcontainer/' + packageId + '/index.json')
                .replyWithFile(200, path.join(__dirname, 'data', 'FindVersionsResponse.json'));
            let target = new NuGetClient('', logger);
            target.PackageSources = [{ source: 'nuget.org', indexUrl: '' }];
            target.NugetServices['nuget.org'] = { autoCompleteService: [], packageRegistrationService: 'https://api.nuget.org/v3-flatcontainer/' };

            let p = target.FindVersionsByPackageId(packageId);

            p.should.eventually.be.fulfilled;
            return p.should.eventually.have.length.greaterThan(1);
        });

        test('Retrieve version numbers for partially given version number', async () => {
            let packageId = 'newtonsoft.json';
            nock('https://api.nuget.org')
                .get('/v3-flatcontainer/' + packageId + '/index.json')
                .replyWithFile(200, path.join(__dirname, 'data', 'FindVersionsResponse.json'));
            let target = new NuGetClient('', logger);
            target.PackageSources = [{ source: 'nuget.org', indexUrl: '' }];
            target.NugetServices['nuget.org'] = { autoCompleteService: [], packageRegistrationService: 'https://api.nuget.org/v3-flatcontainer/' };

            let p = target.FindVersionsByPackageId(packageId, '9.');

            p.should.eventually.be.fulfilled;
            p.should.eventually.have.length.greaterThan(1);
            return p.should.eventually.satisfy(function (versions: string[]) { return versions.every(v => v.startsWith('9.')); });
        });

        test('Gracefully fail when querying versons for unkown packages', async () => {
            let packageId = 'OmniSharp';
            nock('https://api.nuget.org')
                .get('/v3-flatcontainer/' + packageId + '/index.json')
                .replyWithFile(404, path.join(__dirname, 'data', 'PackageNotFound.xml'));
            let target = new NuGetClient('', logger);
            target.PackageSources = [{ source: 'nuget.org', indexUrl: '' }];
            target.NugetServices['nuget.org'] = { autoCompleteService: [], packageRegistrationService: 'https://api.nuget.org/v3-flatcontainer/' };

            let p = target.FindVersionsByPackageId(packageId, '9.');

            p.should.eventually.be.fulfilled;
            return p.should.eventually.deep.equal(['unknown package']);
        });
    });

    suite('CompletionItemProvider', () => {
        test('Provide suggestions for partial packageId');

        test('Provide suggestions for version number of given package');

    });
});