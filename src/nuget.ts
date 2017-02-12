'use strict';

import * as fs from 'fs';
import * as https from 'https';
import { Logger } from './logger';
import * as path from 'path';
import { PlatformInformation } from './platform';
import * as proc from 'process';
import { getProxyAgent } from './proxy';
import { parse as parseUrl } from 'url';
import * as xmlParser from 'xml-parser';

export interface PackageSource {
    source: string;
    indexUrl: string;
}

export interface NuGetService {
    autoCompleteService: string[];
    packageRegistrationService: string;
}

export class NuGetClient{

    constructor(private platformInfo: PlatformInformation) { }

    public PackageSources: PackageSource[] = [];
    public NugetServices: { [id: string]: NuGetService } = {};

    public UpdatePackageSourcesFromConfig(logger: Logger): Promise<boolean> {
        let packageSourcesUpdated = false;
        return new Promise<boolean>((resolve, reject) => {
            let nuGetConfig: string;

            if (this.platformInfo.isWindows) {
                nuGetConfig = path.join(proc.env.AppData, 'NuGet', 'NuGet.config');
            } else {
                // found this on StackOverflow (http://stackoverflow.com/questions/30076371/mac-osx-mono-nuget-how-to-set-up-a-default-appdata-nuget-nuget-config)
                // and this http://gunnarpeipman.com/2014/10/running-asp-net-5-on-linux/
                // TODO: verify the file actually resides there
                nuGetConfig = path.join('~', '.config', 'NuGet', 'NuGet.config');
            }

            logger.appendLine('using active feeds from ' + nuGetConfig);

            fs.readFile(nuGetConfig, 'utf-8', (err, data) => {
                if (err) {
                    reject('Reading ' + nuGetConfig + ' failed with error ' + err);
                }
                let nuget = xmlParser(data);
                let configuration = nuget.root;
                let aps = configuration.children.find(n => n.name === 'activePackageSource');
                aps.children.forEach(aps => {
                    let psIndex = this.PackageSources.findIndex(ps => ps.source === aps.attributes['key']);
                    if (psIndex != -1) {
                        if (this.PackageSources[psIndex].indexUrl != aps.attributes['value']) {
                            this.PackageSources[psIndex].indexUrl = aps.attributes['value'];
                            packageSourcesUpdated = true;
                        }
                    } else {
                        this.PackageSources.push({ source: aps.attributes['key'], indexUrl: aps.attributes['value'] });
                        packageSourcesUpdated = true;
                    }
                    resolve(packageSourcesUpdated);
                });
            });
        });
    };

    public UpdateNuGetService(logger: Logger, packageSource: PackageSource): Promise<boolean> {
        let servicesUpdated = false;
        return new Promise<boolean>((resolve, reject) => {
            this.UpdatePackageSourcesFromConfig(logger).then(updated => {
                if (updated) {
                    logger.append('updating index of ' + packageSource.source);
                    let nugetService: NuGetService;
                    let url = parseUrl(packageSource.indexUrl);
                    let options: https.RequestOptions = {
                        host: url.host,
                        path: url.path,
                        agent: getProxyAgent(url, '', true)
                    };
                    let serviceRequest = https.get(options, response => {
                        let svcIndexString = '';
                        response.on('data', chunk => {
                            svcIndexString += chunk;
                        });
                        response.on('end', () => {
                            let feedIndex = JSON.parse(svcIndexString);
                            let autoCompleteServices: string[] = feedIndex.resources.filter(svc => svc['@type'] === 'SearchAutocompleteService').map(svc => svc['@id']);
                            let pkgRegSvc: string = feedIndex.resources.find(svc => svc['@type'] === 'PackageBaseAddress/3.0.0')['@id'];
                            if (this.NugetServices[packageSource.source]) {
                                if (this.NugetServices[packageSource.source].packageRegistrationService != pkgRegSvc) {
                                    this.NugetServices[packageSource.source].packageRegistrationService = pkgRegSvc;
                                    servicesUpdated = true;
                                }
                                if (autoCompleteServices.some(acs => this.NugetServices[packageSource.source].autoCompleteService.find(svc => svc === acs) == undefined)) {
                                    this.NugetServices[packageSource.source].autoCompleteService = autoCompleteServices;
                                    servicesUpdated = true;
                                }
                            } else {
                                this.NugetServices[packageSource.source] = {
                                    autoCompleteService: autoCompleteServices,
                                    packageRegistrationService: pkgRegSvc
                                };
                                servicesUpdated = true;
                            }
                            resolve(servicesUpdated);
                        });
                    });
                }
            });
        });
    }

    public UpdateNuGetServices(logger: Logger): Promise<void> {
        return new Promise<void>(() => {
            this.PackageSources.forEach(ps => this.UpdateNuGetService(logger, ps))
        });
    }
}