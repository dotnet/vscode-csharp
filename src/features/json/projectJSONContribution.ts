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
    [key: string]: string;
}

export class ProjectJSONContribution implements IJSONContribution {

    private nugetIndexPromise?: Promise<NugetServices>;

    public constructor(private requestService: XHRRequest) {
    }

    public getDocumentSelector(): DocumentSelector {
        return [{ language: 'json', pattern: '**/project.json' }];
    }

    private async getNugetIndex(): Promise<NugetServices> {
        if (this.nugetIndexPromise === undefined) {
            const indexContent = await this.makeJSONRequest<NuGetIndexResponse>(FEED_INDEX_URL);
            const services: NugetServices = {};
            if (indexContent && Array.isArray(indexContent.resources)) {
                const resources = indexContent.resources;
                for (let i = resources.length - 1; i >= 0; i--) {
                    const type = resources[i]['@type'];
                    const id = resources[i]['@id'];
                    if (type && id) {
                        services[type] = id;
                    }
                }
            }
            return services;
        }
        return this.nugetIndexPromise;
    }

    private async getNugetService(serviceType: string): Promise<string> {
        const services = await this.getNugetIndex();
        const serviceURL = services[serviceType];
        if (!serviceURL) {
            return Promise.reject(localize('json.nugget.error.missingservice', 'NuGet index document is missing service {0}', serviceType));
        }
        return serviceURL;
    }

    private async makeJSONRequest<T>(url: string): Promise<T> {
        const response = await this.requestService({
            url: url
        });

        try {
            if (response.status === 200) {
                try {
                    return JSON.parse(response.responseText) as T;
                } catch (e) {
                    return Promise.reject(localize('json.nugget.error.invalidformat', '{0} is not a valid JSON document', url));
                }
            }
            return Promise.reject(localize('json.nugget.error.indexaccess', 'Request to {0} failed: {1}', url, response.responseText));
        } catch (error) {
            return Promise.reject(localize('json.nugget.error.access', 'Request to {0} failed: {1}', url, getErrorStatusDescription((error as XHRResponse).status)));
        }
    }

    public async collectPropertySuggestions(
        resource: string,
        location: Location,
        currentWord: string,
        addValue: boolean,
        isLast: boolean,
        result: ISuggestionsCollector): Promise<void> {
        if ((location.matches(['dependencies']) || location.matches(['frameworks', '*', 'dependencies']) || location.matches(['frameworks', '*', 'frameworkAssemblies']))) {
            try {
                const service = await this.getNugetService('SearchAutocompleteService');
                let queryUrl: string;
                if (currentWord.length > 0) {
                    queryUrl = service + '?q=' + encodeURIComponent(currentWord) + '&take=' + LIMIT;
                } else {
                    queryUrl = service + '?take=' + LIMIT;
                }

                const response = await this.makeJSONRequest<NuGetSearchAutocompleteServiceResponse>(queryUrl);
                if (Array.isArray(response.data)) {
                    const results = response.data;
                    for (let i = 0; i < results.length; i++) {
                        const name = results[i];
                        let insertText = JSON.stringify(name);
                        if (addValue) {
                            insertText += ': "{{}}"';
                            if (!isLast) {
                                insertText += ',';
                            }
                        }
                        const proposal = new CompletionItem(name);
                        proposal.kind = CompletionItemKind.Property;
                        proposal.insertText = insertText;
                        proposal.filterText = JSON.stringify(name);
                        result.add(proposal);
                    }
                    if (results.length === LIMIT) {
                        result.setAsIncomplete();
                    }
                }
            } catch (error) {
                const message = (error as Error).message;
                result.error(message);
            }
        }
    }

    public async collectValueSuggestions(resource: string, location: Location, result: ISuggestionsCollector): Promise<void> {
        if ((location.matches(['dependencies', '*']) || location.matches(['frameworks', '*', 'dependencies', '*']) || location.matches(['frameworks', '*', 'frameworkAssemblies', '*']))) {
            try {
                const service = await this.getNugetService('PackageBaseAddress/3.0.0');
                const currentKey = location.path[location.path.length - 1];
                if (typeof currentKey === 'string') {
                    const queryUrl = service + currentKey + '/index.json';
                    const response = await this.makeJSONRequest<NuGetFlatContainerPackageResponse>(queryUrl);
                    if (Array.isArray(response.versions)) {
                        const results = response.versions;
                        for (let i = 0; i < results.length; i++) {
                            const curr = results[i];
                            const name = JSON.stringify(curr);
                            const proposal = new CompletionItem(name);
                            proposal.kind = CompletionItemKind.Class;
                            proposal.insertText = name;
                            proposal.documentation = '';
                            result.add(proposal);
                        }
                        if (results.length === LIMIT) {
                            result.setAsIncomplete();
                        }
                    }
                }
            } catch (error) {
                const message = (error as Error).message;
                result.error(message);
            }
        }
    }

    public async collectDefaultSuggestions(resource: string, result: ISuggestionsCollector): Promise<void> {
        const defaultValue = {
            'version': '{{1.0.0-*}}',
            'dependencies': {},
            'frameworks': {
                'dnx451': {},
                'dnxcore50': {}
            }
        };
        const proposal = new CompletionItem(localize('json.project.default', 'Default project.json'));
        proposal.kind = CompletionItemKind.Module;
        proposal.insertText = JSON.stringify(defaultValue, null, '\t');
        result.add(proposal);
    }

    public async resolveSuggestion(item: CompletionItem): Promise<CompletionItem | undefined> {
        if (item.kind === CompletionItemKind.Property) {
            const pack = item.label;
            const info = await this.getInfo(<string>pack);
            if (info !== undefined) {
                item.documentation = info.description;
                item.detail = info.version;
                item.insertText = (<string>item.insertText).replace(/\{\{\}\}/, '{{' + info.version + '}}');
            }
            return item;
        }
        return undefined;
    }

    private async getInfo(pack: string): Promise<{ description: string; version: string } | undefined> {
        try {
            const service = await this.getNugetService('SearchQueryService');
            const queryUrl = service + '?q=' + encodeURIComponent(pack) + '&take=' + 5;
            const response = await this.makeJSONRequest<NuGetSearchQueryServiceResponse>(queryUrl);
            if (Array.isArray(response.data)) {
                const results = response.data;
                let info: { description: string; version: string } | undefined;
                for (let i = 0; i < results.length; i++) {
                    const res = results[i];
                    if (res.id === pack) {
                        info = {
                            description: res.description,
                            version: localize('json.nugget.version.hover', 'Latest version: {0}', res.version),
                        };
                    }
                }
                return info;
            }
            return undefined;
        } catch (error) {
            return undefined;
        }
    }


    public async getInfoContribution(resource: string, location: Location): Promise<MarkedString[] | undefined> {
        if ((location.matches(['dependencies', '*']) || location.matches(['frameworks', '*', 'dependencies', '*']) || location.matches(['frameworks', '*', 'frameworkAssemblies', '*']))) {
            const pack = location.path[location.path.length - 1];
            if (typeof pack === 'string') {
                const info = await this.getInfo(pack);
                if (info !== undefined) {
                    const htmlContent: MarkedString[] = [];
                    htmlContent.push(localize('json.nugget.package.hover', '{0}', pack));
                    htmlContent.push(info.description);
                    htmlContent.push(info.version);
                    return htmlContent;
                }
            }
        }
        return undefined;
    }
}
