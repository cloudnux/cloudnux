import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { Config, DevServerStore } from "../types.js";
import { WatchTaskManager } from "../task-manager/index.js";


export const useDevServer = create<DevServerStore>()(immer(
    (set, get) => {
        return {
            modules: [],
            isRunning: false,
            //isWatching: false,
            //isListening: false,
            selectedModule: null,
            selectedEndpoint: null,
            port: "",
            host: "",
            logs: [],
            pinoLogs: [],

            watch: async (config: Config, env: string) => {
                const taskManager = new WatchTaskManager(config, env);

                //taskManager.on("APP_REGISTERED", ({ id, data }) => get().addModule(id, data));
                taskManager.on("ROUTE_REGISTERED", ({ id, data }) => get().addRoute(data));
                taskManager.on("LISTENING", ({ id, data }) => get().startListening(data));
                taskManager.on("ERROR", ({ id, data }) => get().addActionLog(id, data));
                taskManager.on("REQUEST", ({ id, data }) => get().addActionLog(id, data));
                taskManager.on("RESPONSE", ({ id, data }) => get().addActionLog(id, data));
                taskManager.on("LOG", ({ id, data }) => get().addPinoLog(id, data));

                set(() => ({ isRunning: true, environment: env }));
                await taskManager.execute();
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
                    if (modules.length === 0) {
                        console.warn("No modules found to add the endpoint to.");
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
                set({
                    isListening: true,
                    port: data.port,
                    host: data.host
                })
            },
            selectModule: (id: string) => set({ selectedModule: id }),
            selectEndpoint: (endpoint: any) => set({ selectedEndpoint: endpoint }),
            resetSelection: () => set({ selectedModule: null, selectedEndpoint: null }), // Reset both select
        }
    }));
