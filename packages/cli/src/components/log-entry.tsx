import React, { FC } from "react";
import { Box, Text } from "ink";
import { RequestResponseLogLine } from "./request-response-log-line.js";

export const LogEntry: FC<{ log: any, index: number }> = ({ log, index }) => {
    if (typeof log !== 'string' && 'text' in log && 'data' in log) {
        // Handle custom message
        return (
            <Box flexDirection="column">
                <Text color={log.color || 'white'}>
                    {log.text}
                </Text>
                {log.data && (
                    <Text dimColor>{JSON.stringify(log.data)}</Text>
                )}
            </Box>);
    }

    if (typeof log !== 'string' && 'text' in log) {
        // Handle esbuild message
        const location = log.location ? `${log.location.file}:${log.location.line}:${log.location.column}` : '';
        const details = log.detail ? `\n${log.detail}` : '';
        const notes = log.notes?.map((note:any) => note.text).join('\n');
        const prefix = log.pluginName ? `[${log.pluginName}] ` : '';

        return (
            <Box flexDirection="column">
                <Text color="yellow">
                    ⚠ {prefix}{log.text}
                </Text>
                {location && (
                    <Text dimColor> at {location}</Text>
                )}
                {details && (
                    <Text>{details}</Text>
                )}
                {notes && (
                    <Text dimColor>{notes}</Text>
                )}
            </Box>
        );
    }

    if( typeof log === 'object' && 'url' in log && log !== null) {
    return(
        <RequestResponseLogLine log={log} index={index} />
    )
    }
    // Handle string log
    const logLevelMatch = log.match(/^\[(info|error|warning)\]/i);
    const level = logLevelMatch ? logLevelMatch[1].toLowerCase() : 'info';
    const message = logLevelMatch ? log.slice(logLevelMatch[0].length).trim() : log;

    const getLogColor = () => {
        switch (level) {
            case 'error':
                return 'red';
            case 'warning':
                return 'yellow';
            case 'info':
            default:
                return 'white';
        }
    };

    const getLogPrefix = () => {
        switch (level) {
            case 'error':
                return '✖';
            case 'warning':
                return '⚠';
            case 'info':
            default:
                return 'ℹ';
        }
    };

    return (
        <Box>
            <Text color={getLogColor()}>
                {getLogPrefix()} {message}
            </Text>
        </Box>
    );
};