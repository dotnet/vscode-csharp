/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';

import { CompletionItem, CompletionItemKind, DocumentSelector, MarkedString } from 'vscode';
import { IJSONContribution, ISuggestionsCollector } from './jsonContributions';
import { XHRRequest, XHRResponse, getErrorStatusDescription } from 'request-light';

import { Location } from 'jsonc-parser';
import NuGetIndexResponse from './NuGetIndexResponse';
import NuGetSearchAutocompleteServiceResponse from './NuGetSearchAutocompleteServiceResponse';
import NuGetFlatContainerPackageResponse from './NuGetFlatContainerPackageResponse';
import NuGetSearchQueryServiceResponse from './NuGetSearchQueryServiceResponse';

const localize = nls.loadMessageBundle();

const FEED_INDEX_URL = 'https://api.nuget.org/v3/index.json';
const LIMIT = 30;

interface NugetServices {
    'SearchQueryService'?: string;
    'SearchAutocompleteService'?: string;
    'PackageBaseAddress/3.0.0'?: string;
    [key: string]: string;
}

export class ProjectJSONContribution implements IJSONContribution {

    private nugetIndexPromise: Thenable<NugetServices>;

    public constructor(private requestService: XHRRequest) {
    }

    public getDocumentSelector(): DocumentSelector {
        return [{ language: 'json', pattern: '**/project.json' }];
    }

    private getNugetIndex(): Thenable<NugetServices> {
        if (!this.nugetIndexPromise) {
            this.nugetIndexPromise = this.makeJSONRequest<NuGetIndexResponse>(FEED_INDEX_URL).then(indexContent => {
                let services: NugetServices = {};
                if (indexContent && Array.isArray(indexContent.resources)) {
                    let resources = indexContent.resources;
                    for (let i = resources.length - 1; i >= 0; i--) {
                        let type = resources[i]['@type'];
                        let id = resources[i]['@id'];
                        if (type && id) {
                            services[type] = id;
                        }
                    }
                }
                return services;
            });
        }
        return this.nugetIndexPromise;
    }

    private getNugetService(serviceType: string): Thenable<string> {
        return this.getNugetIndex().then(services => {
            let serviceURL = services[serviceType];
            if (!serviceURL) {
                return Promise.reject<string>(localize('json.nugget.error.missingservice', 'NuGet index document is missing service {0}', serviceType));
            }
            return serviceURL;
        });
    }

    private makeJSONRequest<T>(url: string): Thenable<T> {
        return this.requestService({
            url: url
        }).then(success => {
            if (success.status === 200) {
                try {
                    return <T>JSON.parse(success.responseText);
                } catch (e) {
                    return Promise.reject<T>(localize('json.nugget.error.invalidformat', '{0} is not a valid JSON document', url));
                }
            }
            return Promise.reject<T>(localize('json.nugget.error.indexaccess', 'Request to {0} failed: {1}', url, success.responseText));
        }, async (error: XHRResponse) => {
            return Promise.reject<T>(localize('json.nugget.error.access', 'Request to {0} failed: {1}', url, getErrorStatusDescription(error.status)));
        });
    }

    public collectPropertySuggestions(
        resource: string,
        location: Location,
        currentWord: string,
        addValue: boolean,
        isLast: boolean,
        result: ISuggestionsCollector): Thenable<void> {
        if ((location.matches(['dependencies']) || location.matches(['frameworks', '*', 'dependencies']) || location.matches(['frameworks', '*', 'frameworkAssemblies']))) {

            return this.getNugetService('SearchAutocompleteService').then(service => {
                let queryUrl: string;
                if (currentWord.length > 0) {
                    queryUrl = service + '?q=' + encodeURIComponent(currentWord) + '&take=' + LIMIT;
                } else {
                    queryUrl = service + '?take=' + LIMIT;
                }
                return this.makeJSONRequest<NuGetSearchAutocompleteServiceResponse>(queryUrl).then(resultObj => {
                    if (Array.isArray(resultObj.data)) {
                        let results = resultObj.data;
                        for (let i = 0; i < results.length; i++) {
                            let name = results[i];
                            let insertText = JSON.stringify(name);
                            if (addValue) {
                                insertText += ': "{{}}"';
                                if (!isLast) {
                                    insertText += ',';
                                }
                            }
                            let proposal = new CompletionItem(name);
                            proposal.kind = CompletionItemKind.Property;
                            proposal.insertText = insertText;
                            proposal.filterText = JSON.stringify(name);
                            result.add(proposal);
                        }
                        if (results.length === LIMIT) {
                            result.setAsIncomplete();
                        }
                    }
                }, error => {
                    result.error(error);
                });
            }, error => {
                result.error(error);
            });
        }
        return null;
    }

    public collectValueSuggestions(resource: string, location: Location, result: ISuggestionsCollector): Thenable<void> {
        if ((location.matches(['dependencies', '*']) || location.matches(['frameworks', '*', 'dependencies', '*']) || location.matches(['frameworks', '*', 'frameworkAssemblies', '*']))) {
            return this.getNugetService('PackageBaseAddress/3.0.0').then(service => {
                let currentKey = location.path[location.path.length - 1];
                if (typeof currentKey === 'string') {
                    let queryUrl = service + currentKey + '/index.json';
                    return this.makeJSONRequest<NuGetFlatContainerPackageResponse>(queryUrl).then(obj => {
                        if (Array.isArray(obj.versions)) {
                            let results = obj.versions;
                            for (let i = 0; i < results.length; i++) {
                                let curr = results[i];
                                let name = JSON.stringify(curr);
                                let proposal = new CompletionItem(name);
                                proposal.kind = CompletionItemKind.Class;
                                proposal.insertText = name;
                                proposal.documentation = '';
                                result.add(proposal);
                            }
                            if (results.length === LIMIT) {
                                result.setAsIncomplete();
                            }
                        }
                    }, error => {
                        result.error(error);
                    });
                }
            }, error => {
                result.error(error);
            });
        }
        return null;
    }

    public collectDefaultSuggestions(resource: string, result: ISuggestionsCollector): Thenable<null> {
        let defaultValue = {
            'version': '{{1.0.0-*}}',
            'dependencies': {},
            'frameworks': {
                'dnx451': {},
                'dnxcore50': {}
            }
        };
        let proposal = new CompletionItem(localize('json.project.default', 'Default project.json'));
        proposal.kind = CompletionItemKind.Module;
        proposal.insertText = JSON.stringify(defaultValue, null, '\t');
        result.add(proposal);
        return null;
    }

    public resolveSuggestion(item: CompletionItem): Thenable<CompletionItem> {
        if (item.kind === CompletionItemKind.Property) {
            let pack = item.label;
            return this.getInfo(pack).then(info => {
                if (info.description) {
                    item.documentation = info.description;
                }
                if (info.version) {
                    item.detail = info.version;
                    item.insertText = (<string>item.insertText).replace(/\{\{\}\}/, '{{' + info.version + '}}');
                }
                return item;
            });
        }
        return null;
    }

    private getInfo(pack: string): Thenable<{ description?: string; version?: string }> {
        return this.getNugetService('SearchQueryService').then(service => {
            let queryUrl = service + '?q=' + encodeURIComponent(pack) + '&take=' + 5;
            return this.makeJSONRequest<NuGetSearchQueryServiceResponse>(queryUrl).then(resultObj => {
                if (Array.isArray(resultObj.data)) {
                    let results = resultObj.data;
                    let info: { description?: string; version?: string } = {};
                    for (let i = 0; i < results.length; i++) {
                        let res = results[i];
                        if (res.id === pack) {
                            info.description = res.description;
                            info.version = localize('json.nugget.version.hover', 'Latest version: {0}', res.version);
                        }
                    }
                    return info;
                }
                return null;
            }, (error) => {
                return null;
            });
        }, (error) => {
            return null;
        });
    }


    public getInfoContribution(resource: string, location: Location): Thenable<MarkedString[]> {
        if ((location.matches(['dependencies', '*']) || location.matches(['frameworks', '*', 'dependencies', '*']) || location.matches(['frameworks', '*', 'frameworkAssemblies', '*']))) {
            let pack = location.path[location.path.length - 1];
            if (typeof pack === 'string') {
                return this.getInfo(pack).then(info => {
                    let htmlContent: MarkedString[] = [];
                    htmlContent.push(localize('json.nugget.package.hover', '{0}', pack));
                    if (info.description) {
                        htmlContent.push(info.description);
                    }
                    if (info.version) {
                        htmlContent.push(info.version);
                    }
                    return htmlContent;
                });
            }
        }
        return null;
    }
}