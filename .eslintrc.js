module.exports = {
    env: {
        node: true
    },
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
    },
    plugins: [
        "@typescript-eslint",
        "unicorn",
        "header",
        "prettier"
    ],
    root: true,
    rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/semi": ["error", "always"],
        // Allow unused vars if prefixed by _
        "@typescript-eslint/no-unused-vars": [
            "warn",
            { 
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_",
                "caughtErrorsIgnorePattern": "^_"
            }
        ],
        "@typescript-eslint/no-namespace": "off",
        "@typescript-eslint/promise-function-async": "error",
        "prefer-promise-reject-errors": "error",
        "curly": "error",
        "prettier/prettier": [ "error", { "endOfLine": "auto" } ],
        "unicorn/filename-case": [
            "error",
            {
                "case": "camelCase",
                "ignore": [
                    "I[A-Z].*\\.ts$",
                    "vscode-tasks\\.d\\.ts"
                ]
            }
        ],
    },
    ignorePatterns: [
        "out/",
        "dist/",
        "wallaby.js",
        "webpack.config.js",
        ".eslintrc.js",
        "**/*.d.ts"
    ],
};
