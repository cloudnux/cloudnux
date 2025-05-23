import fs from "node:fs/promises";
import path from "node:path";
import ejs from "ejs";

import { Task } from "../../types.js";

/**
 * convert the module template into a compilable function 
 * @param {string} moduleTemplatePath
 * @returns {function} moduleTemplateFunc
 */
export const loadModuleTemplate: Task = {
    title: "Load module template",
    skip: () => false,
    action: async ({ moduleTemplatePath }) => {
        const moduleTemplatePathResolved = path.resolve(__dirname, moduleTemplatePath);
        const template = await fs.readFile(moduleTemplatePathResolved, "utf-8");
        const moduleTemplate = ejs.compile(template, {
            "views": [path.dirname(moduleTemplatePathResolved)]
        });
        return {
            moduleTemplateFunc: moduleTemplate
        }
    }
}