export default {
    "$schema": "../packages/cli/src/config/schema.json",
    "cloudProvider": "aws",
    "modulesPath": "./packages/modules/**/entrypoint.json",
    "workingDir": "./.nux",
    "externalPackages": ["sqlite3", "pino", "aws-sdk", "@aws-sdk/*"],
    "environments": {
        "staging": {
            "tasks": []
        }
    }
}