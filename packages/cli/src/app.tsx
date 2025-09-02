import React, { useMemo } from 'react';
import { extendTheme, defaultTheme, ThemeProvider } from "@inkjs/ui";

import { AppProps } from './types.js';

import BuildView from "./components/build-view.js";
import RunView from "./components/run-view.js";
import { useTaskManager, selectProgress } from "./store/index.js";

export default function App({ config, args }: AppProps) {
	const buildProgress = useTaskManager(selectProgress());
	const isBuildComplete = buildProgress >= 1;
	const hasWatch = config.environments[args.inputs.env]?.watch;

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

	const shouldShowBuildView = !hasWatch || !isBuildComplete;
	const shouldShowRunView = hasWatch && isBuildComplete;

	return (
		<ThemeProvider theme={theme}>
			{shouldShowBuildView && <BuildView config={config} args={args} />}
			{shouldShowRunView && <RunView config={config} args={args} />}
		</ThemeProvider>
	)
}
