import React from 'react';
import { render } from 'ink';

import { loadConfig } from "./config/index.js";
import { loadArgs } from "./arguments/index.js";
import App from './app.js';


const args = loadArgs();
const config = await loadConfig(args.flags.configFile);

render(<App args={args} config={config} />);
