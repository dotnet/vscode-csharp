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
        logger = new Logger(text => channel.append(text));
        PlatformInformation.GetCurrent().then((pi) => platformInfo = pi);
    });

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

    test('Retrieve packages from NuGet Gallery', () => {
        let partialPackageId = 'newtonsoft';
    });

    test('Retrieve the versions for the selected package', () => {

    });
});