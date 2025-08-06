import React, { FC } from "react";
import { Box, Text } from "ink";

export const RequestResponseLogLine: FC<{ log: any, index: number }> = ({ log, index }) => {
    const getColor = (log:any) => {
        if(!('responseStatus' in log)) {
            return 'blue';
        }
        if (log.responseStatus >= 500) {
            return 'red';
        }
        if (log.responseStatus >= 400) {
            return 'yellow';
        }
        if (log.responseStatus >= 300) {
            return 'cyan';
        }
        return 'green';
    }
    return (
        <Box>
            <Text key={index} color={getColor(log)}>[{log.method}]({log.url}): {log.time}</Text>
            <Text key={index}> - {JSON.stringify(log)}</Text>
        </Box>);
};