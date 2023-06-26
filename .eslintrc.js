module.exports = {
    env: {
        node: true
    },
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    parser: "@typescript-eslint/parser",
    plugins: [
        "@typescript-eslint",
        "unicorn"
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
        "unicorn/filename-case": [
            "error",
            {
                "case": "camelCase",
                "ignore": [
                    "I[A-Z].*\\.ts$",
                    "vscode-tasks\\.d\\.ts"
                ]
            }
        ]
    },
    ignorePatterns: [
        "out/",
        "dist/"
    ],
};
