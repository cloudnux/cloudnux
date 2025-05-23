import { Config } from "../types.js";

import {
    loadModuleTemplate,
    loadDevServerTemplate,
    locateModules,
    transformDevServer,
    devServerWatch,
    loadTriggerTemplate,
    transferTerraformModules
} from "../task-manager/index.js";


export const defaultConfig: Config = {
    modulesPath: './packages/modules/**/entrypoint.json',
    cloudProvider: 'aws',
    workingDir: "./.epf",
    environments: {
        develop: {
            moduleTemplatePath: "./templates/local/module.ts.ejs",
            devServerTemplatePath: "./templates/local/dev-server.ts.ejs",
            externalPackages: ["sqlite3", "pino"],
            tasks: [
                loadModuleTemplate,
                loadDevServerTemplate,
                locateModules,
                transformDevServer
            ],
            watch: devServerWatch
        },
        production: {
            moduleTemplatePath: "./templates/cloud/entrypoint-build.ts.ejs",
            triggerTemplatePath: "./templates/cloud/entrypoint-triggers.tf.ejs",
            externalPackages: ["aws-sdk", "@aws-sdk/*"],
            tasks: [
                loadModuleTemplate,
                loadTriggerTemplate,
                locateModules,
                transferTerraformModules,
            ],
            cloudProvider: {
                type: "aws",
            }
        }

    }
}