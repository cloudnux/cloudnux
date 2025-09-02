import { Config, TaskParam } from "../types.js";
import { BaseTaskManager } from "./base-task-manager.js";

export class BuildTaskManager extends BaseTaskManager {
    constructor(config: Config, environment: string) {
        super(config, environment);
    }

    public async execute(): Promise<void> {
        const envConfig = this.config.environments[this.environment];
        if (!envConfig) {
            throw new Error(`Environment ${this.environment} not found in config`);
        }
        for (const task of envConfig.tasks) {
            try {
                await this.executeTask(task, {} as TaskParam);
            }
            catch (error) {
                console.error(error);
                //error already emitted in executeTask, so sowllow it and it wont be displated twice.
                // and stp the execution of the tasks
                return;
            }
        }
    }

}