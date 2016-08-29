import { workspace, Uri, TextDocument, Disposable, TextDocumentContentProvider} from 'vscode';
import { MetadataResponse } from '../omnisharp/protocol';

export class DefinitionMetadataDocumentProvider implements TextDocumentContentProvider, Disposable {
    private _scheme = "omnisharp-metadata";
    private _registration : Disposable;
    private _documents: Map<string, MetadataResponse>;
    private _documentClosedSubscription: Disposable;

    constructor() {
        this._documents = new Map<string, MetadataResponse>();
        this._documentClosedSubscription = workspace.onDidCloseTextDocument(this.onTextDocumentClosed);
    }

    private onTextDocumentClosed(document: TextDocument) : void {
        this._documents.delete(document.uri.toString());
    }

    public dispose() : void {
        this._registration.dispose();
        this._documentClosedSubscription.dispose();
        this._documents.clear();
    }

    public addMetadataResponse(metadataResponse: MetadataResponse) : Uri {
        const uri = this.createUri(metadataResponse);

        this._documents.set(uri.toString(), metadataResponse);

        return uri;
    }

    public register() : void {
        this._registration = workspace.registerTextDocumentContentProvider(this._scheme, this);
    }

    public provideTextDocumentContent(uri : Uri) : string {
        return this._documents.get(uri.toString()).Source;
    }

    private createUri(metadataResponse: MetadataResponse) : Uri {
        return Uri.parse(this._scheme + "://" +
                         metadataResponse.SourceName.replace(/\\/g, "/")
                                                    .replace(/(.*)\/(.*)/g, "$1/[metadata] $2"));
    }
}