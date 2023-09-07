/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { tolerantParse } from '../../src/json';
import * as jestLib from '@jest/globals';

jestLib.describe('JSON', () => {
    jestLib.test('no comments', () => {
        const text = `{
    "hello": "world"
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(text);
    });

    jestLib.test('no comments (minified)', () => {
        const text = `{"hello":"world","from":"json"}`;

        const expected = `{
    "hello": "world",
    "from": "json"
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(expected);
    });

    jestLib.test('single-line comment before JSON', () => {
        const text = `// comment
{
    "hello": "world\\"" // comment
}`;

        const expected = `{
    "hello": "world\\""
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(expected);
    });

    jestLib.test('single-line comment on separate line', () => {
        const text = `{
    // comment
    "hello": "world"
}`;

        const expected = `{
    "hello": "world"
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(expected);
    });

    jestLib.test('single-line comment at end of line', () => {
        const text = `{
    "hello": "world" // comment
}`;

        const expected = `{
    "hello": "world"
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(expected);
    });

    jestLib.test('single-line comment at end of text', () => {
        const text = `{
    "hello": "world"
} // comment`;

        const expected = `{
    "hello": "world"
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(expected);
    });

    jestLib.test('ignore single-line comment inside string', () => {
        const text = `{
    "hello": "world // comment"
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(text);
    });

    jestLib.test('single-line comment after string with escaped double quote', () => {
        const text = `{
    "hello": "world\\"" // comment
}`;

        const expected = `{
    "hello": "world\\""
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(expected);
    });

    jestLib.test('multi-line comment at start of text', () => {
        const text = `/**/{
    "hello": "world"
}`;

        const expected = `{
    "hello": "world"
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(expected);
    });

    jestLib.test('comment out key/value pair', () => {
        const text = `{
    /*"hello": "world"*/
    "from": "json"
}`;

        const expected = `{
    "from": "json"
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(expected);
    });

    jestLib.test('multi-line comment at end of text', () => {
        const text = `{
    "hello": "world"
}/**/`;

        const expected = `{
    "hello": "world"
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(expected);
    });

    jestLib.test('ignore multi-line comment inside string', () => {
        const text = `{
    "hello": "wo/**/rld"
}`;

        const expected = `{
    "hello": "wo/**/rld"
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(expected);
    });

    jestLib.test('ignore BOM', () => {
        const text = `\uFEFF{
    "hello": "world"
}`;

        const expected = `{
    "hello": "world"
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(expected);
    });

    jestLib.test('ignore trailing comma in object member list', () => {
        const text = `{
    "obj": {
        "hello": "world",
        "from": "json",
    }
}`;

        const expected = `{
    "obj": {
        "hello": "world",
        "from": "json"
    }
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(expected);
    });

    jestLib.test('ignore trailing comma in array element list', () => {
        const text = `{
    "array": [
        "element1",
        "element2",
    ]
}`;

        const expected = `{
    "array": [
        "element1",
        "element2"
    ]
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(expected);
    });

    jestLib.test('ignore trailing comma in object member list with leading and trailing whitespace', () => {
        const text = `{
    "obj": { "a" : 1 , }
}`;

        const expected = `{
    "obj": {
        "a": 1
    }
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(expected);
    });

    jestLib.test('single-line comments in multiple locations', () => {
        const text = `
// This comment should be allowed.
{
    // This comment should be allowed.
    "version": "2.0.0",         // This comment should be allowed.
    "tasks": [
        // This comment should be allowed.
        {
            "label":   "foo",       // This comment should be allowed.
            "type":    "shell",
            "command": "true",
            // This comment should be allowed.
        },
    ],
}
// This comment should be allowed.`;

        const expected = `{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "foo",
            "type": "shell",
            "command": "true"
        }
    ]
}`;

        const json = tolerantParse(text);
        const result = JSON.stringify(json, null, 4);

        jestLib.expect(result).toEqual(expected);
    });
});
