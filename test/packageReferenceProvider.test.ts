import { should } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { Logger } from '../src/logger';
import { PackageManager } from '../src/packages';
import { PlatformInformation } from '../src/platform';
import PackageReferenceProvider from '../src/features/packageReferenceProvider';
import * as vscode from 'vscode';

suite("Resolve package refs and versions from NuGet", () => {
    let logger: Logger;
    let platformInfo: PlatformInformation;

    suiteSetup(() => {
        should();
        chai.use(chaiAsPromised);
        let channel: vscode.OutputChannel = vscode.window.createOutputChannel("test");
        logger = new Logger(text => channel.append(text));
        PlatformInformation.GetCurrent().then((pi) => platformInfo = pi);
    });

    test('Retrieve packages from NuGet Gallery', () => {
        let partialPackageId = 'newtonsoft';
        let target = new PackageManager(platformInfo, logger);
        let packagePromise = target.FindPackageIds(logger, partialPackageId);
        packagePromise.should.be.fulfilled;
        packagePromise.should.eventually.not.be.empty;
    });

    test('Retrieve the versions for the selected package', () => {

    });
});