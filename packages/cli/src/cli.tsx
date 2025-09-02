// import React from 'react';
// import { render } from 'ink';

import { loadConfig } from "./config/index.js";
import { loadArgs } from "./arguments/index.js";

import { BuildTaskManager, WatchTaskManager } from "./task-manager/index.js";


//import App from './app.js';

const args = loadArgs();
const config = await loadConfig(args.flags.configFile);

const builder = new BuildTaskManager(config, args.inputs.env);
await builder.execute();

const watcher = new WatchTaskManager(config, args.inputs.env);
await watcher.execute();

// render(<App args={args} config={config} />, {
//     exitOnCtrlC: true,
//     "patchConsole": false
// });
