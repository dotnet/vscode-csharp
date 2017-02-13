import { should, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { Logger } from '../src/logger';
import { NuGetClient, PackageSource } from '../src/nuget';
//import { OmniSharpServer } from '../src/omnisharp/server';
import { PlatformInformation } from '../src/platform';
import PackageReferenceProvider from '../src/features/packageReferenceProvider';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

suite("Resolve package refs and versions from NuGet", () => {
    //let server: OmniSharpServer;
    let logger: Logger;
    let platformInfo: PlatformInformation;

    suiteSetup(() => {
        should();
        use(chaiAsPromised);
        //server = new OmniSharpServer(new TelemetryReporter('test', '0.0.0-test', 'test'));
        let channel: vscode.OutputChannel = vscode.window.createOutputChannel("test");
        logger = new Logger(() => channel.hide());
        PlatformInformation.GetCurrent().then((pi) => platformInfo = pi);
    });

    suite('NuGetClient', () => {

        test('Read activePackageSources from user scoped NuGet.config', () => {
            let nugetOrg = {source: 'nuget.org', indexUrl: 'https://api.nuget.org/v3/index.json'};
            let target = new NuGetClient(platformInfo);
            let p = target.UpdatePackageSourcesFromConfig(logger).then((result) => {
                result.should.be.true;
                target.PackageSources.should.contain(nugetOrg);
            });
            return p.should.eventually.be.fulfilled;
        });

        test('Update NuGet services for package sources', () => {
            let autoCompleteService = 'https://api-v2v3search-0.nuget.org/autocomplete';
            let packageRegistrationService = 'https://api.nuget.org/v3-flatcontainer/';
            let target = new NuGetClient(platformInfo);
            let packageSource: PackageSource = { source: 'nuget.org', indexUrl: 'https://api.nuget.org/v3/index.json' };
            let p = target.UpdateNuGetService(logger, packageSource).then((result) => {
                result.should.be.true;
                target.NugetServices[packageSource.source].autoCompleteService.should.contain(autoCompleteService);
                target.NugetServices[packageSource.source].packageRegistrationService.should.equal(packageRegistrationService);
            });
            return p.should.eventually.be.fulfilled;
        });

        test('Retrieve package ids for partial packageId from NuGet Gallery');

        test('Don\'t call out to NuGet gallery for empty package id');

        test('Retrieve all version numbers for the selected package');

        test('Retrieve version numbers for partially given version number');
    });

    suite('CompletionItemProvider', () => {
        test('Provide suggestions for partial packageId');

        test('Provide suggestions for version number of give package');

    });
});