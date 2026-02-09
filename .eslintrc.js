module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true,
        "es2020": true,
        "node": true
    },
    "globals": {
        "ePub": true,
        "JSZip": true
    },
    "parser": "@typescript-eslint/parser",
    "plugins": ["@typescript-eslint"],
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 2020,
        "sourceType": "module"
    },
    "rules": {
        "indent": "off",
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "warn",
            "double"
        ],
        "semi": ["warn", "always"],
        "no-console" : ["warn"],
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
          "warn",
          { "vars": "all", "args": "none" }
        ],
        "no-mixed-spaces-and-tabs": ["warn", "smart-tabs"],
        "no-prototype-builtins": "warn",
        "no-redeclare": "warn",
        "no-useless-escape": "warn",
        "valid-jsdoc": "off"
    },
    "overrides": [
        {
            "files": ["**/*.ts"],
            "rules": {
                "no-undef": "off"
            }
        },
        {
            "files": ["test/**/*.js"],
            "env": {
                "mocha": true
            }
        }
    ]
};
