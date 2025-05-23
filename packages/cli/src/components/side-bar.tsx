// Sidebar.tsx
import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useTaskManager } from '../store/index.js';

const Sidebar: React.FC = () => {
    const { selectedModule, modules, selectEndpoint, selectedEndpoint, resetSelection, selectModule } = useTaskManager();
    const selectedIndex = modules.findIndex((module) => module.id === selectedModule);

    useInput((input, key) => {
        if (key.upArrow && !selectedEndpoint) {
            const newIndex = (selectedIndex - 1 + modules.length) % modules.length;
            selectModule(modules[newIndex].id);
        }
        if (key.downArrow && !selectedEndpoint) {
            const newIndex = (selectedIndex + 1) % modules.length;
            selectModule(modules[newIndex].id);
        }
        if (key.return && selectedModule) {
            selectEndpoint(modules[selectedIndex].endpoints[0]);
            // Enter key pressed
            // console.log(`Selected app: ${selectModule}`);
            // You can add additional logic here, such as fetching logs for the selected app
        }
        if (key.escape) {
            // Esc key pressed
            resetSelection();
        }
    });

    return (
        <Box flexDirection="column" width="20%" borderStyle="round" borderColor="green">
            <Text bold color="yellow">
                Modules
            </Text>
            {modules.map((module) => (
                <Text
                    key={module.id}
                    color={selectedModule === module.id ? 'cyan' : 'white'}
                >
                    {module.name}
                </Text>
            ))}
        </Box>
    );
};

export default Sidebar;