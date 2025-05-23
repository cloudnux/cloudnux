import React, { useEffect, useMemo, useState } from 'react';
import { extendTheme, defaultTheme, ThemeProvider } from "@inkjs/ui";
import { Box, useStdout, Text } from "ink";

import { Args, Config } from './types.js';
import { useTaskManager } from "./store/index.js";
import { PrepareView } from "./components/prepare-view.js";
import Sidebar from './components/side-bar.js';
import ContentView from './components/content-view.js';
import ActionLogs from './components/action-logs.js';

export type AppProps = {
	config: Config,
	args: Args
}

export default function App({ config, args }: AppProps) {
	const { stdout } = useStdout();
	const theme = useMemo(() => {
		return extendTheme(defaultTheme, {
			components: {
				ProgressBar: {
					styles: {
						completed: () => {
							return {
								color: "green"
							}
						}
					}
				}
			}
		});
	}, []);
	useMemo(() => {
		const onResize = () => {
			setDimensions([stdout.columns, stdout.rows]);
		};

		// Listen for resize events
		stdout.on('resize', onResize);

		// Cleanup
		return () => {
			stdout.off('resize', onResize);
		};
	}, [stdout]);
	const [dimensions, setDimensions] = useState<[number, number]>([
		stdout.columns,
		stdout.rows,
	]);

	const [width, height] = dimensions;

	const start = useTaskManager(state => state.start);
	const isListening = useTaskManager(state => state.isListening);
	const port = useTaskManager(state => state.port);
	const host = useTaskManager(state => state.host);
	useEffect(() => {
		start(config, args.inputs.env);
	}, []);

	return (
		<ThemeProvider theme={theme}>
			<PrepareView />
			{isListening &&
				<Box flexDirection="column" width={width} height={height}>
					<Text>Server Listening on http://[{host}]:{port}</Text>
					<Box flexDirection="row" width="100%" height="40%">
						<Sidebar />
						<ContentView />

					</Box>
					<ActionLogs />
				</Box>
			}
		</ThemeProvider>
	)
}
