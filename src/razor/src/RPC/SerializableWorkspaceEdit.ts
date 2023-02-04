/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { SerializableRenameDocument } from '../Rename/SerializableRenameDocument';
import { SerializableCreateDocument } from './SerializableCreateDocument';
import { SerializableDeleteDocument } from './SerializableDeleteDocument';
import { SerializableTextDocumentEdit } from './SerializableTextDocumentEdit';
import { convertTextEditFromSerializable, SerializableTextEdit } from './SerializableTextEdit';

type SerializableDocumentChange = SerializableCreateDocument | SerializableRenameDocument | SerializableDeleteDocument | SerializableTextDocumentEdit;

export interface SerializableWorkspaceEdit {
    changes?: {[key: string]: Array<SerializableTextEdit>};
    documentChanges?: Array<SerializableDocumentChange>;
}

export function convertWorkspaceEditFromSerializable(data: SerializableWorkspaceEdit): vscode.WorkspaceEdit {
    const workspaceEdit = new vscode.WorkspaceEdit();

    if (Array.isArray(data.documentChanges)) {
        for (const documentChange of data.documentChanges) {
            if (documentChange.kind === 'create') {
                const createDocumentChange = documentChange as SerializableCreateDocument;
                workspaceEdit.createFile(vscode.Uri.parse(createDocumentChange.uri), createDocumentChange.options);
            } else if (documentChange.kind === 'rename') {
                const renameDocumentChange = documentChange as SerializableRenameDocument;
                workspaceEdit.renameFile(vscode.Uri.parse(renameDocumentChange.oldUri), vscode.Uri.parse(renameDocumentChange.newUri), renameDocumentChange.options);
            } else if (documentChange.kind === 'delete') {
                const deleteDocumentChange = documentChange as SerializableDeleteDocument;
                workspaceEdit.deleteFile(vscode.Uri.parse(deleteDocumentChange.uri), deleteDocumentChange.options);
            } else {
                const editDocumentChange = documentChange as SerializableTextDocumentEdit;
                const changes = editDocumentChange.edits.map(convertTextEditFromSerializable);
                workspaceEdit.set(vscode.Uri.parse(editDocumentChange.textDocument.uri), changes);
            }
        }
    }

    if (data.changes !== undefined) {
        for (const uri in data.changes) {
            if (!data.changes.hasOwnProperty(uri)) {
                continue;
            }
            const changes = data.changes[uri].map(convertTextEditFromSerializable);
            workspaceEdit.set(vscode.Uri.parse(uri), changes);
        }
    }

    return workspaceEdit;
}
