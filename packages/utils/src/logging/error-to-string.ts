export const errorToString = (error: unknown): string => {
    // Handle null or undefined
    if (error === null) return 'Null error';
    if (error === undefined) return 'Undefined error';

    // Handle Error objects
    if (error instanceof Error) {
        return [
            `Name: ${error.name}`,
            `Message: ${error.message}`,
            `Stack: ${error.stack || 'No stack trace available'}`,
            // Handle additional properties that might exist on custom errors
            ...Object.entries(error)
                .filter(([key]) => !['name', 'message', 'stack'].includes(key))
                .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        ].join('\n');
    }

    // Handle strings
    if (typeof error === 'string') return error;

    // Handle objects
    if (typeof error === 'object') {
        try {
            return JSON.stringify(error, null, 2);
        } catch {
            return `[Object that cannot be stringified: ${Object.prototype.toString.call(error)}]`;
        }
    }

    // Handle other primitives
    return String(error);
};
