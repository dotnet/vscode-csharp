/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { tolerantParse } from '../../src/json';

suite("JSON", () => {
    suiteSetup(() => should());

    test("no comments", () => {
        const text =
            `{
    "hello": "world"
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(text);
    });

    test("no comments (minified)", () => {
        const text =
            `{"hello":"world","from":"json"}`;

        const expected =
            `{
    "hello": "world",
    "from": "json"
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(expected);
    });

    test("single-line comment before JSON", () => {
        const text =
            `// comment
{
    "hello": "world\\"" // comment
}`;

        const expected =
            `{
    "hello": "world\\""
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(expected);
    });

    test("single-line comment on separate line", () => {
        const text =
            `{
    // comment
    "hello": "world"
}`;

        const expected =
            `{
    "hello": "world"
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(expected);
    });

    test("single-line comment at end of line", () => {
        const text =
            `{
    "hello": "world" // comment
}`;

        const expected =
            `{
    "hello": "world"
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(expected);
    });

    test("single-line comment at end of text", () => {
        const text =
            `{
    "hello": "world"
} // comment`;

        const expected =
            `{
    "hello": "world"
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(expected);
    });

    test("ignore single-line comment inside string", () => {
        const text =
            `{
    "hello": "world // comment"
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(text);
    });

    test("single-line comment after string with escaped double quote", () => {
        const text =
            `{
    "hello": "world\\"" // comment
}`;

        const expected =
            `{
    "hello": "world\\""
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(expected);
    });

    test("multi-line comment at start of text", () => {
        const text =
            `/**/{
    "hello": "world"
}`;

        const expected =
            `{
    "hello": "world"
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(expected);
    });

    test("comment out key/value pair", () => {
        const text =
            `{
    /*"hello": "world"*/
    "from": "json"
}`;

        const expected =
            `{
    "from": "json"
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(expected);
    });

    test("multi-line comment at end of text", () => {
        const text =
            `{
    "hello": "world"
}/**/`;

        const expected =
            `{
    "hello": "world"
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(expected);
    });

    test("ignore multi-line comment inside string", () => {
        const text =
            `{
    "hello": "wo/**/rld"
}`;

        const expected =
            `{
    "hello": "wo/**/rld"
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(expected);
    });

    test("ignore BOM", () => {
        const text =
            `\uFEFF{
    "hello": "world"
}`;

        const expected =
            `{
    "hello": "world"
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(expected);
    });

    test("ignore trailing comma in object member list", () => {
        const text =
            `{
    "obj": {
        "hello": "world",
        "from": "json",
    }
}`;

        const expected =
            `{
    "obj": {
        "hello": "world",
        "from": "json"
    }
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(expected);
    });

    test("ignore trailing comma in array element list", () => {
        const text =
            `{
    "array": [
        "element1",
        "element2",
    ]
}`;

        const expected =
            `{
    "array": [
        "element1",
        "element2"
    ]
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(expected);
    });

    test("ignore trailing comma in object member list with leading and trailing whitespace", () => {
        const text =
            `{
    "obj": { "a" : 1 , }
}`;

        const expected =
            `{
    "obj": {
        "a": 1
    }
}`;

        let json = tolerantParse(text);
        let result = JSON.stringify(json, null, 4);

        result.should.equal(expected);
    });
});
