/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export enum LanguageCodeKind {
    /** VS Code language identifier */
    VSCode = 'VSCode',
    /** Transifex language identifier */
    Transifex = 'Transifex',
}

/** Language code correspondences for a single language. */
export class Language {
    public readonly transifex: string;

    public constructor(
        /** VS Code language identifier */
        public readonly vscode: string,
        /** Transifex language identifier */
        transifex?: string,
        /** `true` iff this is the default language. Default `false`. */
        public readonly isDefault: boolean = false
    ) {
        this.transifex = transifex ?? vscode;
    }

    public getCode(kind: LanguageCodeKind): string {
        switch (kind) {
            case LanguageCodeKind.VSCode:
                return this.vscode;
            case LanguageCodeKind.Transifex:
                return this.transifex;
            default:
                throw new Error(`Unrecognized language code kind ${kind}`);
        }
    }
}

/**
 * List of supported languages.
 *
 * Copied from vscode-cmake-tools sources:
 * @see {@link https://github.com/microsoft/vscode-cmake-tools/blob/e2d75bd1b73649cfdd1ee1317795bc19901c5b96/gulpfile.js#L29}
 *
 */
// prettier-ignore
export const languages: Language[] = [
  //           VSCode   Transifex  default?
  new Language("en",    undefined, true),
  new Language("zh-tw", "zh-hant"),
  new Language("zh-cn", "zh-hans"),
  new Language("fr"),
  new Language("de"),
  new Language("it"),
  new Language("es"),
  new Language("ja"),
  new Language("ko"),
  new Language("ru"),
//new Language("bg"), // VS Code supports Bulgarian, but loc team is not currently generating it
//new Language("hu"), // VS Code supports Hungarian, but loc team is not currently generating it
  new Language("pt-br", "pt-BR"),
  new Language("tr",    "tr-TR"),
  new Language("cs",    "cs-CZ"),
  new Language("pl",    "pl-PL"),
];

/** Languages for which a translation exists. */
export const translatedLanguages = (): Language[] => languages.filter((lang) => !lang.isDefault);

/** The default language */
export function defaultLanguage(): Language {
    const defaultLanguageFound = languages.find((lang) => lang.isDefault);
    if (defaultLanguageFound === null || defaultLanguageFound === undefined) {
        throw new Error('Assert failed: Unexpected null in finding the default language');
    }

    return defaultLanguageFound;
}
