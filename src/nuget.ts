'use strict';

import * as fs from 'fs';
import * as https from 'https';
import { Logger } from './logger';
import * as path from 'path';

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

    constructor(private configXml: string, private logger: Logger) { }

    public PackageSources: PackageSource[] = [];
    public NugetServices: { [id: string]: NuGetService } = {};

    public ReadConfigFromFile(): Promise<string> {
        let pathToConfig: string[] = [];
        if (proc.platform === 'win32') {
            pathToConfig.push(path.join(proc.env.AppData, 'NuGet', 'NuGet.config'));
            // push machine wide config paths
        } else {
            // found this on StackOverflow (http://stackoverflow.com/questions/30076371/mac-osx-mono-nuget-how-to-set-up-a-default-appdata-nuget-nuget-config)
            // and this http://gunnarpeipman.com/2014/10/running-asp-net-5-on-linux/
            // TODO: verify the file actually resides there
            pathToConfig.push(path.join('~', '.config', 'NuGet', 'NuGet.config'));
        }
        return new Promise<string>((resolve, reject) => {
            for (let i = 0; i < pathToConfig.length; i++) {
                if (fs.existsSync(pathToConfig[i])) {
                    fs.readFile(pathToConfig[i], 'utf-8', (err, data) => {
                        if (err) {
                            this.logger.append('Reading ' + pathToConfig + 'failed with error ' + err);
                            this.configXml = '';
                        }
                        if (data.length > 0) {
                            this.logger.append('Using active package sources from ' + pathToConfig[i]);
                            this.configXml = data;
                            resolve(this.configXml);
                            return;
                        }
                    });
                }
            }
            this.logger.append('No config file found.');
            resolve('');
        });
    }

    public UpdatePackageSourcesFromConfig(): Promise<boolean> {
        let packageSourcesUpdated = false;
        return new Promise<boolean>((resolve, reject) => {
            if (this.configXml.length === 0 && this.PackageSources.length === 0) {
                this.logger.append('No config and no package sources available. Using nuget.org as default');
                let nugetOrg: PackageSource = { source: 'nuget.org', indexUrl: 'https://api.nuget.org/v3/index.json' };
                this.PackageSources.push(nugetOrg);
                packageSourcesUpdated = true;
            } else {
                let nuget = xmlParser(this.configXml);
                let configuration = nuget.root;
                let aps = configuration.children.find(n => n.name === 'activePackageSource');
                aps.children.forEach(aps => {
                    let psIndex = this.PackageSources.findIndex(ps => ps.source === aps.attributes['key']);
                    if (psIndex != -1) {
                        if (this.PackageSources[psIndex].indexUrl != aps.attributes['value']) {
                            this.logger.append('Updating the indexUrl of existing package source ' + aps.attributes['key']);
                            this.PackageSources[psIndex].indexUrl = aps.attributes['value'];
                            packageSourcesUpdated = true;
                        }
                    } else {
                        this.logger.append('Adding new source ' + aps.attributes['key'] + 'with index URL ' + aps.attributes['value'] + 'to package sources.');
                        this.PackageSources.push({ source: aps.attributes['key'], indexUrl: aps.attributes['value'] });
                        packageSourcesUpdated = true;
                    }
                });
            }
            resolve(packageSourcesUpdated);
        });
    }

    public UpdateNuGetService(packageSource: PackageSource): Promise<boolean> {
        let servicesUpdated = false;
        return new Promise<boolean>((resolve, reject) => {
            this.UpdatePackageSourcesFromConfig().then(updated => {
                if (updated) {
                    this.logger.append('updating index of ' + packageSource.source);
                    let url = parseUrl(packageSource.indexUrl);
                    let options: https.RequestOptions = {
                        host: url.host,
                        path: url.path,
                        agent: getProxyAgent(url, '', true)
                    };
                    https.get(options, response => {
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

    public UpdateNuGetServices(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.PackageSources.forEach(ps => this.UpdateNuGetService(ps));
            resolve();
        });
    }

    public FindPackagesByPartialId(partialPackageId: string, maxResults?: number): Promise<string[]> {
        if (!maxResults) {
            // this could be used to make the limit configurable via a OmniSharp Setting
            maxResults = 20;
        }
        return new Promise<string[]>((resolve, reject) => {
            let packageIds: string[] = [];
            let requests: Promise<string[]>[] = [];
            this.PackageSources.forEach(ps => {
                requests.push(new Promise<string[]>((res, rej) => {
                    let urlString: string;
                    if (partialPackageId) {
                        urlString = this.NugetServices[ps.source].autoCompleteService[0] + '?q=' + partialPackageId + '&take=' + maxResults;
                    } else {
                        urlString = this.NugetServices[ps.source].autoCompleteService[0] + '?take=' + maxResults;
                    }
                    let url = parseUrl(urlString);
                    let options: https.RequestOptions = {
                        host: url.host,
                        path: url.path,
                        agent: getProxyAgent(url, '', true)
                    };
                    https.get(options, response => {
                        let json: string = '';
                        response.on('data', (chunk) => json += chunk);
                        response.on('end', () => {
                            let payload = JSON.parse(json);
                            res(payload.data);
                        });
                    });
                }));
            });
            Promise.all(requests).then(payloads => {
                payloads.forEach(payload => {
                    if (packageIds.length === 0) {
                        packageIds = payload;
                    } else {
                        packageIds.concat(payload);
                    }
                });
                resolve(packageIds);
            });
        });
    }
}