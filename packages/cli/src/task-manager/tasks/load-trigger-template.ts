import fs from "node:fs/promises";
import path from "node:path";
import ejs from "ejs";

import { Task } from "../../types.js";
import { transformTriggerTemplate } from "./transform-trigger-template.js";

/**
 * convert the module trigger template into a compilable function 
 * @param {string} triggerTemplatePath
 * @returns {function} triggerTemplateFunc
 */
export const loadTriggerTemplate: Task = {
    title: "Load trigger template",
    skip: () => false,
    action: async ({ triggerTemplatePath }) => {
        const triggerTemplatePathResolved = path.resolve(__dirname, triggerTemplatePath);
        const template = await fs.readFile(triggerTemplatePathResolved, "utf-8");
        const triggerTemplate = ejs.compile(template, {
            "views": [path.dirname(triggerTemplatePathResolved)]
        });
        return {
            triggerTemplateFunc: triggerTemplate
        }
    },
    children: [
        transformTriggerTemplate
    ]
}