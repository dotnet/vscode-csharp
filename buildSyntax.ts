import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as plist from 'plist';

function writePlistFile(grammar: any, fileName: string) {
    const text = plist.build(grammar);
    fs.writeFileSync(fileName, text, "utf8");
}

function readYaml(fileName: string) {
    const text = fs.readFileSync(fileName, "utf8");
    return yaml.safeLoad(text);
}

function buildGrammar() {
    const tsGrammar = readYaml("syntaxes/csharp.tmLanguage.yml");

    // Write csharp.tmLanguage
    writePlistFile(tsGrammar, "syntaxes/csharp.tmLanguage");
}

buildGrammar();