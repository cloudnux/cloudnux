import { loadConfig } from "./config/index.js";
import { loadArgs } from "./arguments/index.js";

import { BuildTaskManager, WatchTaskManager } from "./task-manager/index.js";

const args = loadArgs();
const config = await loadConfig(args.flags.configFile);

const builder = new BuildTaskManager(config, args.inputs.env, args.inputs.module);
await builder.run();

const watcher = new WatchTaskManager(config, args.inputs.env, args.inputs.module);
await watcher.run();