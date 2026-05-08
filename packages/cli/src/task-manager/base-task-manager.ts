import path from "node:path";
import fs from "node:fs/promises";
import fg from "fast-glob";
import _pickBy from "lodash/pickBy.js"

import { Config, Task, TaskEntry, TaskParam } from "../types.js";

export abstract class BaseTaskManager {
    private _tasksCount: number;
    private resolvedNamespace?: string;

    protected config: Config;
    protected environment: string;
    protected selectedModule?: string;
    protected modules: Record<string, string>;
    protected taskResults: Record<string, any>;

    constructor(config: Config, environment: string, selectedModule?: string) {
        this.config = config;
        this.environment = environment;
        this.selectedModule = selectedModule;
        this.modules = {};
        this.taskResults = {};

        const envConfig = this.config.environments[this.environment];
        if (!envConfig) {
            throw new Error(`Environment ${this.environment} not found in config`);
        }

        this._tasksCount =
            envConfig.tasks.reduce((count, task) => {
                return count + (task.children ? task.children.length + 1 : 1);
            }, 0);
    }

    private generateTaskId() {
        return Math.random().toString(36).substring(2, 11);
    }

    private getTaskTitle(task: Task, params: TaskParam): string {
        return typeof task.title === 'function' ? task.title(params) : task.title;
    }

    protected async executeTask(
        entry: TaskEntry,
        params: TaskParam,
        parentTaskId?: string
    ): Promise<any> {
        const { task, children } = entry;
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
            namespace: this.resolvedNamespace,
            modulesPath: this.config.modulesPath,
            selectedModule: this.selectedModule,
            modules: this.modules,
            cloudProvider: this.config.cloudProvider,
            workingDir: path.resolve(this.config.workingDir, this.environment),
            externalPackages: this.config.externalPackages,
            ...this.taskResults,
        };
        delete taskParams.tasks;

        // Skip if condition is met
        if (task.skip?.(taskParams)) {
            return null;
        }

        // Execute subtasks if present
        const executeSubTasks = async (subTaskParams: TaskParam): Promise<any[]> => {
            if (!children || children.length === 0) {
                return [];
            }

            const results = [];
            for (const child of children) {
                const newSubTaskParams = {
                    ...subTaskParams,
                    ...results.reduce((acc, result) => {
                        return {
                            ...acc,
                            ...result,
                        };
                    }, {})
                }
                const result = await this.executeTask({ task: child }, newSubTaskParams, taskId);
                results.push(result);
            }
            return results;
        };

        taskParams.executeSubTasks = executeSubTasks;
        // Execute the task action
        try {
            const result = await task.action(taskParams);

            // Store result for next tasks if it's a top-level task
            if (!parentTaskId) {
                this.taskResults = {
                    ...this.taskResults,
                    ...result
                }
            }
            return result;
        } catch (error) {
            throw new Error(`Task ${this.getTaskTitle(task, taskParams)} failed: ${(error as Error).message}`);
        }
    }

    protected abstract execute(): Promise<void>;

    public async run() {
        this.resolvedNamespace = this.config.namespace;
        if (!this.resolvedNamespace) {
            try {
                const pkg = JSON.parse(await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8'));
                this.resolvedNamespace = pkg.name;
            } catch { /* no package.json at cwd */ }
        }

        const entrypoints = await fg(this.config.modulesPath);
        const modules = entrypoints.reduce((acc, entrypoint) => {
            const name = path.basename(path.dirname(entrypoint));
            acc[name] = entrypoint;
            return acc;
        }, {} as Record<string, string>);
        this.modules = this.selectedModule
            ? _pickBy(modules, (_, name) => name === this.selectedModule)
            : modules;
        await this.execute();
    }

    public get tasksCount() {
        return this._tasksCount;
    }
}