import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { BuildTaskManager } from "../task-manager/index.js";
import { TaskManagerStore, TaskState, TaskStatus, Config } from "../types.js";

export const useTaskManager = create<TaskManagerStore>()(immer(
    (set, get) => {
        return {
            // execution
            tasks: {},
            currentTaskId: null,
            environment: 'development',
            isRunning: false,
            isWatching: false,
            tasksCount: 0,

            start: async (config: Config, env: string) => {
                const taskManager = new BuildTaskManager(config, env);
                console.log("[starting ...]");
                set(() => ({ isRunning: true, environment: env, tasksCount: taskManager.tasksCount }));

                taskManager.on("new", task => get().addTask(task));
                taskManager.on("start", ({ id }) => get().updateTaskStatus(id, 'running'));
                taskManager.on("success", ({ id }) => get().updateTaskStatus(id, "completed"));
                taskManager.on("failure", ({ id, error }) => get().updateTaskStatus(id, "error", error));
                taskManager.on("skip", ({ id }) => get().updateTaskStatus(id, "skipped"));
                taskManager.on("log", ({ id, log, data }) => get().addTaskLog(id, log, data));

                await taskManager.execute();

                set(() => ({ isRunning: false, currentTaskId: null }));
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
            }
        }
    }));

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
    return completedTasks.length / state.tasksCount;
}