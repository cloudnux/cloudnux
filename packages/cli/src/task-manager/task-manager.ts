import EventEmitter from "node:events";
import path from "node:path";

import { Config, Task, TaskParam } from "../types.js";

type EVENTS = "new" | "start" | "success" | "failure" | "skip" | "log" | "APP_REGISTERED" | "ROUTE_REGISTERED" | "LISTENING" | "ERROR" | "REQUEST" | "RESPONSE" | "LOG";

export class TaskManager {
    private config: Config;
    private environment: string;
    private taskResults: Record<string, any>;
    private events: EventEmitter;

    constructor(config: Config, environment: string) {
        this.config = config;
        this.environment = environment;
        this.taskResults = new Map();
        this.events = new EventEmitter();
    }

    private generateTaskId() {
        return Math.random().toString(36).substring(2, 11);
    }

    private getTaskTitle(task: Task, params: TaskParam): string {
        return typeof task.title === 'function' ? task.title(params) : task.title;
    }

    private async executeTask(
        task: Task,
        params: TaskParam,
        parentTaskId?: string
    ): Promise<any> {
        const taskId = parentTaskId
            ? `${parentTaskId}:${this.generateTaskId()}`
            : this.generateTaskId();

        // Prepare base params with environment specific config
        const envConfig = this.config.environments[this.environment];
        const taskParams: TaskParam = {
            ...params,
            ...envConfig,
            title: this.getTaskTitle(task, params),
            environment: this.environment,
            modulesPath: this.config.modulesPath,
            cloudProvider: this.config.cloudProvider,
            workingDir: path.resolve(this.config.workingDir, this.environment),
            ...this.taskResults,
        };
        delete taskParams.tasks;

        // Emit new task event
        this.events.emit("new", {
            id: taskId,
            title: taskParams.title,
            parentTaskId
        })

        // Skip if condition is met
        if (task.skip && task.skip(taskParams)) {
            this.events.emit("skip", {
                id: taskId,
            })
            return null;
        }

        //=> task is ready to be executed
        this.events.emit("start", {
            id: taskId,
        });

        // Execute subtasks if present
        const executeSubTasks = async (subTaskParams: TaskParam): Promise<any[]> => {
            if (!task.children || task.children.length === 0) {
                return [];
            }

            const results = [];
            for (const child of task.children) {
                const newSubTaskParams = {
                    ...subTaskParams,
                    ...results.reduce((acc, result) => {
                        return {
                            ...acc,
                            ...result,
                        };
                    }, {})
                }
                const result = await this.executeTask(child, newSubTaskParams, taskId);
                results.push(result);
            }
            return results;
        };

        const logger = (arg: any, data?: any) => {
            this.events.emit("log", {
                id: taskId,
                log: arg,
                data
            });
        };

        const eventEmitter = (type: string, data?: any) => {
            this.events.emit(type, {
                id: taskId,
                data
            })
        }

        // Execute the task action
        try {
            const result = await task.action(taskParams, logger, eventEmitter, executeSubTasks);

            // Store result for next tasks if it's a top-level task
            if (!parentTaskId) {
                this.taskResults = {
                    ...this.taskResults,
                    ...result
                }
            }

            // Emit task success event
            this.events.emit("success", {
                id: taskId,
            });

            return result;
        } catch (error) {
            // Emit task failure event
            this.events.emit("failure", {
                id: taskId,
                error: (error as Error).message,
            });
            throw new Error(`Task ${taskId} failed: ${(error as Error).message}`);
        }
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
                //error already emitted in executeTask, so sowllow it and it wont be displated twice.
                // and stp the execution of the tasks
                return;
            }
        }
    }

    public async watch(): Promise<void> {
        const envConfig = this.config.environments[this.environment];
        if (envConfig.watch)
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

    public on(event: EVENTS, listener: (...args: any[]) => void): void {
        this.events.on(event, listener);
    }

    public off(event?: EVENTS) {
        if (event)
            this.events.removeAllListeners(event);
        else
            this.events.removeAllListeners();
    }
}