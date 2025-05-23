import fs from "node:fs/promises";
import path from "node:path";

import { Task } from "../../types.js";

/**
 * Transfer the terraform modules to the working directory
 * @param {string} workingDir
 */
export const transferTerraformModules: Task = {
    title: `Transfer Terraform Modules`,
    skip: () => false,
    action: async ({
        workingDir
    }) => {
        await fs.mkdir(workingDir, { recursive: true });
        const deployDir = path.join(workingDir, ".deploy");
        const sourceDir = path.join(__dirname, "../.deploy");
        await fs.cp(sourceDir, deployDir, {
            recursive: true,
            force: true,
            errorOnExist: false
        });
    }
}