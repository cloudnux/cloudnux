import { Config, Environment, Task, TaskParam, TaskTitle } from "../types";

// Type guards for validation
function isString(value: unknown): value is string {
    return typeof value === 'string';
}

function isFunction(value: unknown): value is Function {
    return typeof value === 'function';
}

function isTaskTitle(value: unknown): value is TaskTitle {
    return isString(value) || isFunction(value);
}

function isTask<TTaskParams extends TaskParam>(value: unknown): value is Task {
    if (!value || typeof value !== 'object') return false;

    const task = value as Task;

    // Validate required fields
    if (!isTaskTitle(task.title)) return false;
    if (typeof task.action !== 'function') return false;

    // Validate optional fields
    if (task.skip !== undefined && typeof task.skip !== 'function') return false;

    // Validate children if they exist
    if (task.children !== undefined) {
        if (!Array.isArray(task.children)) return false;
        return task.children.every(child => isTask(child));
    }

    return true;
}

function isEnvironment<TTaskParams extends TaskParam>(value: unknown): value is Environment {
    if (!value || typeof value !== 'object') return false;

    const env = value as Environment;
    if (!Array.isArray(env.tasks)) return false;

    return env.tasks.every(task => isTask(task));
}

export function validateConfig<TTaskParams extends TaskParam>(config: unknown): config is Config {
    if (!config || typeof config !== 'object') {
        throw new Error('Config must be an object or a function that returns an object');
    }

    const typedConfig = config as Config;

    // Validate required fields
    if (!isString(typedConfig.modulesPath)) {
        throw new Error('Config.modulesPath must be a string');
    }

    if (!isString(typedConfig.cloudProvider)) {
        throw new Error('Config.cloudProvider must be a string');
    }

    if (!isString(typedConfig.workingDir)) {
        throw new Error('Config.workingDir must be a string');
    }

    // Validate environments
    if (!typedConfig.environments || typeof typedConfig.environments !== 'object') {
        throw new Error('Config.environments must be an object');
    }

    // Check each environment
    for (const [envName, env] of Object.entries(typedConfig.environments)) {
        if (!isEnvironment(env)) {
            throw new Error(`Invalid environment configuration for "${envName}"`);
        }
    }

    return true;
}