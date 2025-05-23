import React from 'react';
import { Box, Text } from "ink";
import { useTaskManager } from '../store/index.js';

const ActionLogs: React.FC = () => {
    const logs = useTaskManager(state => state.logs);

    return (
        <Box borderStyle="round" flexDirection='column' borderColor="green" width="100%" height="60%">
            <Text bold color="yellow">General Logs</Text>
            {logs.map((log, index) => (
                <Box>
                    <Text key={index} color="greenBright">[{log.method}]({log.url}): {log.time}</Text>
                    <Text key={index}> - {JSON.stringify(log)}</Text>
                </Box>
            ))}

        </Box>
    );
};

export default ActionLogs;