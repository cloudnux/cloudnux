import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useStdout } from "ink";

import { useDevServer } from "../store/index.js";
import Sidebar from './side-bar.js';
import ContentView from './content-view.js';
import ActionLogs from './action-logs.js';
import { AppProps } from "../types.js";

export default function RunView({ config, args }: AppProps) {
    const { stdout } = useStdout();
    const watch = useDevServer(state => state.watch);
    const host = useDevServer(state => state.host);
    const port = useDevServer(state => state.port);
    const isRunning = useDevServer(state => state.isRunning);

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

    useEffect(() => {
        watch(config, args.inputs.env);
    }, [])

    if (!isRunning)
        return null;

    return (
        <Box flexDirection="column" width={width} height={height}>
            <Text>Server Listening on http://[{host}]:{port}</Text>
            <Box flexDirection="row" width="100%" height="40%">
                <Sidebar />
                <ContentView />
            </Box>
            <ActionLogs />
        </Box>
    );
}