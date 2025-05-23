import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { TaskManager } from "../task-manager/task-manager.js";
import { TaskManagerStore, TaskState, TaskStatus, Config } from "../types.js";

export const useTaskManager = create<TaskManagerStore>()(immer(
    (set, get) => {
        return {
            tasks: {},
            currentTaskId: null,
            environment: 'development',
            isRunning: false,
            isListening: false,
            selectedModule: null,
            selectedEndpoint: null,
            modules: [],
            port: '',
            host: '',
            logs: [],
            pinoLogs: [],
            start: async (config: Config, env: string) => {
                const taskManager = new TaskManager(config, env);

                set(() => ({ isRunning: true, environment: env }));

                taskManager.on("new", task => get().addTask(task));
                taskManager.on("start", ({ id }) => get().updateTaskStatus(id, 'running'));
                taskManager.on("success", ({ id }) => get().updateTaskStatus(id, "completed"));
                taskManager.on("failure", ({ id, error }) => get().updateTaskStatus(id, "error", error));
                taskManager.on("skip", ({ id }) => get().updateTaskStatus(id, "skipped"));
                taskManager.on("log", ({ id, log, data }) => get().addTaskLog(id, log, data));
                taskManager.on("APP_REGISTERED", ({ id, data }) => get().addModule(id, data));
                taskManager.on("ROUTE_REGISTERED", ({ id, data }) => get().addRoute(data));
                taskManager.on("LISTENING", ({ id, data }) => get().startListening(data));
                taskManager.on("ERROR", ({ id, data }) => get().addActionLog(id, data));
                taskManager.on("REQUEST", ({ id, data }) => get().addActionLog(id, data));
                taskManager.on("RESPONSE", ({ id, data }) => get().addActionLog(id, data));
                taskManager.on("LOG", ({ id, data }) => get().addPinoLog(id, data));


                await taskManager.execute();

                set(() => ({ isRunning: false, currentTaskId: null }));
                await taskManager.watch();
                set(() => ({ isWatching: true }));
            },


            addTask: (task: { id: string, title: string, parentTaskId?: string }) => {
                const newTask: TaskState = {
                    id: task.id,
                    title: task.title,
                    status: 'pending',
                    parentId: task.parentTaskId,
                    children: [],
                    logs: []
                };

                set((state) => {
                    // Add the new task
                    state.tasks[task.id] = newTask;

                    // If there's a parent task, update its children
                    if (task.parentTaskId) {
                        const parentTaskState = state.tasks[task.parentTaskId];
                        if (parentTaskState) {
                            state.tasks[task.parentTaskId].children = [
                                ...parentTaskState.children,
                                task.id
                            ];
                        }
                    }

                    state.currentTaskId = task.id;
                });

            },
            updateTaskStatus: (taskId: string, status: TaskStatus, error?: string) => {
                set((state) => {
                    const task = state.tasks[taskId];
                    if (!task) return state;

                    // Update task status
                    task.status = status;
                    task.error = error || task.error;
                });
            },
            addTaskLog: (taskId: string, log: string | object, data: any) => {
                set((state) => {
                    const task = state.tasks[taskId];
                    if (!task) return state;
                    if (data) log = { text: log, data };
                    task.logs = [...task.logs, log];
                });
            },
            addModule: (id: string, opts: any) => {
                set((state) => {
                    let modules = state.modules;
                    if (modules.length > 0) {
                        state.modules = [...modules, {
                            id: opts.prefix,
                            name: opts.prefix,
                            endpoints: [],
                            data: opts
                        }]
                        return state;
                    }
                    state.modules = [{
                        id: opts.prefix,
                        name: opts.prefix,
                        endpoints: [],
                        data: opts
                    }]
                    return state;
                });
            },
            addRoute: (endpoint: any) => {
                set((state) => {
                    let modules = state.modules;
                    if (modules.length < 0) {
                        return state;
                    }
                    state.modules[modules.length - 1].endpoints = [...modules[modules.length - 1].endpoints, endpoint];
                    return state;
                });
            },
            addActionLog(id: string, data: any) {
                const logs = get().logs;
                if (logs.length >= 5) {
                    logs.shift();
                }

                set({ logs: [...logs, data] });
            },
            addPinoLog: (id: string, data: any) => {
                const logs = get().pinoLogs;
                if (logs.length >= 5) {
                    logs.shift();
                }

                set({ pinoLogs: [...logs, data] });
            },
            startListening: (data) => {
                if (!data) return;
                set({ isListening: true, port: data.port, host: data.host })
            },
            selectModule: (id: string) => set({ selectedModule: id }),
            selectEndpoint: (endpoint: any) => set({ selectedEndpoint: endpoint }),
            resetSelection: () => set({ selectedModule: null, selectedEndpoint: null }), // Reset both select
        }
    }));


// useTaskManager.subscribe(state => {
//     console.log("[State updated]", state, "\n\n");
// })


export const selectTask = (taskId: string) => (state: TaskManagerStore) =>
    state.tasks[taskId];

export const selectTaskChildren = (taskId: string) => (state: TaskManagerStore) => {
    const task = state.tasks[taskId];
    return task ? task.children.map(childId => state.tasks[childId]) : [];
};

export const selectTaskWithDescendants = (taskId: string) => (state: TaskManagerStore) => {
    const task = state.tasks[taskId];
    if (!task) return null;

    const getDescendants = (taskState: TaskState): TaskState[] => {
        return [
            taskState,
            ...taskState.children.flatMap(childId => {
                const childTask = state.tasks[childId];
                return childTask ? getDescendants(childTask) : [];
            })
        ];
    };

    return getDescendants(task);
};

export const selectAllWithDescendants = () => (state: TaskManagerStore) => {
    return Object
        .values(state.tasks)
        .filter(task => !task.children.length)
        .map(task => selectTaskWithDescendants(task.id)(state));
};

export const selectRootTasks = () => (state: TaskManagerStore) => {
    return Object
        .values(state.tasks)
        .filter(task => !task.parentId);
}

export const selectProgress = () => (state: TaskManagerStore) => {
    const allTasks = Object.values(state.tasks);
    const completedTasks = allTasks.filter(task => task.status === "completed");
    return completedTasks.length / allTasks.length;
}