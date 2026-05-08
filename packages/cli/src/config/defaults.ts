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
import { locateSourceEntry } from "../task-manager/tasks/locate-source-entry.js";
import { transformModule } from "../task-manager/tasks/transform-module.js";
import { transformTriggerTemplate } from "../task-manager/tasks/transform-trigger-template.js";
import { buildServer } from "../task-manager/tasks/build-server.js";


export const defaultConfig: Config = {
    modulesPath: './packages/modules/**/entrypoint.json',
    cloudProvider: 'aws',
    workingDir: "./.nux",
    externalPackages: ["aws-sdk", "@aws-sdk/*"],
    environments: {
        develop: {
            port: 3000,
            moduleTemplatePath: "./templates/local/module.ts.ejs",
            devServerTemplatePath: "./templates/local/dev-server.ts.ejs",
            tasks: [
                { task: loadModuleTemplate },
                { task: loadDevServerTemplate },
                {
                    task: locateModules,
                    children: [
                        locateSourceEntry,
                        transformModule,
                    ]
                },
                { task: transformDevServer },
            ],
            watch: devServerWatch
        },
        production: {
            moduleTemplatePath: "./templates/cloud/entrypoint-build.ts.ejs",
            triggerTemplatePath: "./templates/cloud/entrypoint-triggers.tf.ejs",
            tasks: [
                { task: loadModuleTemplate },
                { task: loadTriggerTemplate },
                {
                    task: locateModules,
                    children: [
                        locateSourceEntry,
                        transformModule,
                        transformTriggerTemplate,
                        buildServer
                    ]
                }
            ]
        }

    }
}