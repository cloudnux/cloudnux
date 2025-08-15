export type TaskParamBase = Record<string, any>;

export type TaskParam = {

    modulesPath: string,

    /**
     * cloud provider package to use, any locally installed package can be used 
     * aws is an alias for @cloudnux/aws-cloud-provider
     * azure is an alias for @cloudnux/azure-cloud-provider
     * gcp is an alias for @cloudnux/gcp-cloud-provider 
     */
    cloudProvider: string,

    /**
     * Path to store the current environment build artifacts
     * @default '.epf/<environment>'
     */
    workingDir: string,

    /**
     * task title
     * @note: this is set by the task manager
     */
    title?: string;

    /**
     * environment name
     */
    environment: string,

    /**
     * logger function to log messages
     */
    logger: (arg: any, data?: any) => void;

    /**
     * event emitter function to emit events
     */
    eventEmitter: (type: string, data?: any) => void;
    
    //TODO: reference same param from parent task
    children?: Task[];


    [key: string]: any;

}

export type TaskTitle = string | ((params: TaskParam) => string);

export type Task<TTaskParams extends TaskParamBase = any> = {
    title: string | ((params: TTaskParams) => string);
    action: (params: TTaskParams) => any | Promise<any>;
    skip?: (params: TTaskParams) => boolean;
    children?: Task<TTaskParams>[];
}

export type Environment<TTaskParams extends TaskParamBase = any> = {
    /**
     * tasks to be executed for this environment
     */
    tasks: Task<TTaskParams>[],

    /**
     * watch task
     * if set, task will be executed and all logs will be routed to the watch view. 
     * This is useful for development environments where you want to see the logs in real-time
     * @note: process will not exit until error or ctrl+c is pressed
     * @default undefined
     */
    watch?: Task,
    /**
     * additional parameters for this environment
     */
    [key: string]: any
}

export type Config<TTaskParams extends TaskParamBase = any> = {
    /**
     * glob Path to find all modules (package.json) having entrypoints 
     * @default './packages/modules/**\/package.json'
    */
    modulesPath: string,

    /**
     * cloud provider package to use, any locally installed package can be used 
     * aws is an alias for @cloudnux/aws-cloud-provider
     * azure is an alias for @cloudnux/azure-cloud-provider
     * gcp is an alias for @cloudnux/gcp-cloud-provider 
     * @default 'aws'
     */
    cloudProvider: string,

    /**
     * Path to store the build artifacts for all environments
     * @default './.epf'
     */
    workingDir: string,

    /**
     * environment configuration with key as environment name and value as Environment
     * @default { develop: { tasks: [] }, prod: { tasks: [] } }
     */
    environments: Record<string, Environment<TTaskParams>>,

    /**
     * External packages to be used in the module build
     * @default: ["aws-sdk", "@aws-sdk/*"]
     */
    externalPackages: string[],
}

export type Args = {
    inputs: {
        env: string,
        module?: string
    },
    flags: {
        configFile: string | undefined
    }
}

type Module = {
    id: string;
    name: string;
    endpoints: any[];
    data?: any;
}


//=================================

export type TaskStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

export interface TaskState {
    id: string;
    title: string;
    status: TaskStatus;
    error?: string;
    children: string[];
    logs: any[];
    parentId?: string;
}

export interface Log {
    url: string;
    method: string;
    status: number;
    payload: any;
    time: Date;
}

export interface TaskManagerStore {
    tasks: Record<string, TaskState>;
    currentTaskId: string | null;
    environment: string;
    isRunning: boolean;
    isListening: boolean;
    modules: Module[];
    selectedModule: string | null;
    selectedEndpoint: any | null;
    port: string;
    host: string;
    logs: Array<any>; // Changed to Array<any> to allow any type of log
    pinoLogs: Array<any>; // Changed to Array<any> to allow any type of log

    // Actions
    start: (config: Config, env: string) => Promise<void>;
    addTask: (task: { id: string, title: string, parentTaskId?: string }) => void;
    updateTaskStatus: (taskId: string, status: TaskStatus, error?: string) => void;
    addTaskLog: (taskId: string, log: any, data: any) => void;
    addModule: (id: string, opts: any) => void;
    addRoute: (route: any) => void;
    addActionLog(id: string, data: any): void;
    addPinoLog(id: string, data: any): void;
    startListening: ({ host, port }: { host: string, port: string }) => void;

    // Navigations
    selectModule: (id: string) => void;
    selectEndpoint: (endpoint: any) => void;
    resetSelection: () => void; // New action to reset selections
}