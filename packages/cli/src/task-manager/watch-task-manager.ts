import { Config, TaskParam } from "../types.js";
import { BaseTaskManager } from "./base-task-manager.js";

export class WatchTaskManager extends BaseTaskManager {
    constructor(config: Config, environment: string) {
        super(config, environment);
    }

    public async execute(): Promise<void> {
        const envConfig = this.config.environments[this.environment];
        if (envConfig.watch) {
            try {
                await this.executeTask(envConfig.watch, {} as TaskParam);
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
