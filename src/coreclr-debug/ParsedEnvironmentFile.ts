/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';

export class ParsedEnvironmentFile {
    public Env: { [key: string]: any };
    public Warning: string | null;

    private constructor(env: { [key: string]: any }, warning: string | null) {
        this.Env = env;
        this.Warning = warning;
    }

    public static CreateFromFile(envFile: string, initialEnv: { [key: string]: any } | undefined): ParsedEnvironmentFile {
        let content: string = fs.readFileSync(envFile, "utf8");
        return this.CreateFromContent(content, envFile, initialEnv);
    }

    public static CreateFromContent(content: string, envFile: string, initialEnv: { [key: string]: any } | undefined): ParsedEnvironmentFile {

        // Remove UTF-8 BOM if present
        if (content.charAt(0) === '\uFEFF') {
            content = content.substr(1);
        }

        let parseErrors: string[] = [];
        let env: { [key: string]: any } = initialEnv;
        if (!env) {
            env = {};
        }

        content.split("\n").forEach(line => {
            // Split the line between key and value
            const r: RegExpMatchArray = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);

            if (r !== null) {
                const key: string = r[1];
                let value: string = r[2] || "";
                if ((value.length > 0) && (value.charAt(0) === '"') && (value.charAt(value.length - 1) === '"')) {
                    value = value.replace(/\\n/gm, "\n");
                }

                value = value.replace(/(^['"]|['"]$)/g, "");

                env[key] = value;
            }
            else {
                // Blank lines and lines starting with # are no parse errors
                const comments: RegExp = new RegExp(/^\s*(#|$)/);
                if (!comments.test(line)) {
                    parseErrors.push(line);
                }
            }
        });

        // show error message if single lines cannot get parsed
        let warning: string = null;
        if (parseErrors.length !== 0) {
            warning = "Ignoring non-parseable lines in envFile " + envFile + ": ";
            parseErrors.forEach(function (value, idx, array) {
                warning += "\"" + value + "\"" + ((idx !== array.length - 1) ? ", " : ".");
            });
        }

        return new ParsedEnvironmentFile(env, warning);
    }
}