import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useDevServer } from '../store/index.js';
import { RequestResponseLogLine } from './request-response-log-line.js';

const ContentView: React.FC = () => {
    const { selectedModule, selectedEndpoint, modules, selectEndpoint, logs } = useDevServer();
    const module = modules.find((a) => a.id === selectedModule);
    const selectedIndex = module?.endpoints.findIndex((e) => (e.url === selectedEndpoint?.url && e.method === selectedEndpoint?.method)) ?? -1;

    // // Limit logs to the last 5 entries
    // const displayedLogs = pinoLogs.slice(-5);

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
            // setLogs((logs) => [...logs, `Log entry ${logs.length + 1}`]);
        }
    });

    const selectedEndpointLogs = selectedEndpoint ? logs.filter(log => log.url === selectedEndpoint?.url && log.method === selectedEndpoint?.method) : [];

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
                <Box flexDirection="column" borderStyle="round" borderColor="gray" >
                    <Box>
                        <Text bold color="yellow">
                            Logs for {selectedEndpoint.method} - {selectedEndpoint.url}:
                        </Text>
                    </Box>
                    <Box flexDirection='column'>
                        {selectedEndpointLogs.map((log, index) => (
                            <RequestResponseLogLine key={index} log={log} index={index} />
                        ))}
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default ContentView;