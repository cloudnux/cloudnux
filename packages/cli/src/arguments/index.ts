import meow from "meow";

import { Args } from "../types.js";

export function loadArgs() {
    const args = meow(
        `
	Usage
	  $ nux <enviroment>

	Options
		--config  Your config file path

	Examples
	  $ nux develop --config=./config.json
`,
        {
            importMeta: import.meta,
            flags: {
                config: {
                    isRequired: false,
                    type: 'string',
                },
            },
        },
    );

    return {
        inputs: {
            env: args.input[0],
            module: args.input[1]
        },
        flags: {
            configFile: args.flags.config
        }
    } as Args;
}