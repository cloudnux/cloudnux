import React from 'react';
import { Box, Text } from "ink";
import { useDevServer } from '../store/index.js';
import { LogEntry } from './log-entry.js';

const ActionLogs: React.FC = () => {
    const logs = useDevServer(state => state.logs);

    return (
        <Box borderStyle="round" flexDirection='column' borderColor="green" width="100%" height="60%">
            <Text bold color="yellow">General Logs</Text>
            {logs.map((log, index) => (
                <LogEntry key={index} log={log} index={index} />
            ))}

        </Box>
    );
};

export default ActionLogs;