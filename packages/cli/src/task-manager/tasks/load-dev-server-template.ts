import fs from "node:fs/promises";
import path from "node:path";
import ejs from "ejs";

import { Task } from "../../types.js";

/**
 * convert the dev server template into a compilable function 
 * @param {string} moduleTemplatePath
 * @returns {function} devServerTemplateFunc
 */
export const loadDevServerTemplate: Task = {
    title: "Load Dev Server template",
    skip: () => false,
    action: async ({ devServerTemplatePath }) => {
        const devServerTemplatePathResolved = path.resolve(__dirname, devServerTemplatePath);
        const template = await fs.readFile(devServerTemplatePathResolved, "utf-8");
        const devServerTemplate = ejs.compile(template, {
            "views": [path.dirname(devServerTemplatePathResolved)]
        });
        return {
            devServerTemplateFunc: devServerTemplate
        }
    }
}