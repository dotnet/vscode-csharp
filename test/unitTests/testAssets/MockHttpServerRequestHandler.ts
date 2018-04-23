/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface MockHttpServerRequestHandler {
    method: string;
    path: string;
    reply: {
        status: number;
        headers?: any;
        body: any;
    };

}

export function getRequestHandler(method: string, path: string, reply_status: number, reply_headers?: any, reply_body?: any): MockHttpServerRequestHandler {
    return {
        method,
        path,
        reply: {
            status: reply_status,
            headers: reply_headers,
            body: reply_body
        }
    };
}