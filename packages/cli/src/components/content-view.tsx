// ContentView.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTaskManager } from '../store/index.js';

const ContentView: React.FC = () => {
    const { selectedModule, selectedEndpoint, modules, selectEndpoint } = useTaskManager();
    const module = modules.find((a) => a.id === selectedModule);
    const selectedIndex = module?.endpoints.findIndex((e) => (e.url === selectedEndpoint?.url && e.method === selectedEndpoint?.method)) ?? -1;

    // Sample logs (replace with real logs)
    const [logs, setLogs] = useState([
        'Log entry 1',
        'Log entry 2',
        'Log entry 3',
        'Log entry 4',
        'Log entry 5',
        'Log entry 6',
        'Log entry 7',
    ]);

    // Limit logs to the last 5 entries
    const displayedLogs = logs.slice(-5);

    useInput((input, key) => {
        if (key.upArrow && selectedModule && module && selectedIndex >= 0) {
            const newIndex = (selectedIndex - 1 + module.endpoints.length) % module.endpoints.length;
            selectEndpoint(module.endpoints[newIndex]);
        }
        if (key.downArrow && selectedModule && module && selectedIndex >= 0) {
            const newIndex = (selectedIndex + 1) % module.endpoints.length;
            selectEndpoint(module.endpoints[newIndex]);
        }
        if (key.rightArrow) {
            setLogs((logs) => [...logs, `Log entry ${logs.length + 1}`]);
        }
    });

    return (
        <Box flexDirection="column" justifyContent='space-between' width="80%" borderStyle="round" borderColor="blue">
            <Box flexDirection="column" width="100%">

                <Text bold color="yellow">
                    Endpoints
                </Text>
                {module ? (
                    module.endpoints.map((endpoint, index) => (
                        <Text
                            key={index}
                            color={(selectedEndpoint?.url === endpoint.url && endpoint.method === selectedEndpoint?.method) ? 'cyan' : 'white'}
                        >
                            {endpoint.method}   -   {endpoint.url}
                        </Text>
                    ))
                ) : (
                    <Text>Select an app to view its endpoints</Text>
                )}
            </Box>

            {/* Logs Section */}
            {selectedEndpoint && (
                <Box flexDirection="column" borderStyle="round" borderColor="gray">
                    <Text bold color="yellow">
                        Logs for {selectedEndpoint.method} - {selectedEndpoint.url}:
                    </Text>
                    {displayedLogs.map((log, index) => (
                        <Text key={index}>{log}</Text>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default ContentView;