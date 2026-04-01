const safeJsonStringify = (value: unknown): string => {
    const seen = new WeakSet<object>();

    return JSON.stringify(value, (key, currentValue: unknown) => {
        if (key === 'constructor') return undefined;

        if (typeof currentValue === 'object' && currentValue !== null) {
            if (seen.has(currentValue)) return '[Circular]';
            seen.add(currentValue);
        }

        return currentValue;
    });
};

const hasOwnConstructorProp = (value: unknown): boolean => {
    if (typeof value !== 'object' || value === null) return false;

    return Object.prototype.hasOwnProperty.call(value, 'constructor');
};

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
                .filter(
                    ([key, value]) =>
                        !['name', 'message', 'stack'].includes(key) && !hasOwnConstructorProp(value)
                )
                .map(([key, value]) => `${key}: ${safeJsonStringify(value)}`)
        ].join('\n');
    }

    // Handle strings
    if (typeof error === 'string') return error;

    // Handle objects
    if (typeof error === 'object') {
        try {
            return JSON.stringify(
                error,
                (key, value: unknown) => {
                    if (key === 'constructor') return undefined;
                    return value;
                },
                2
            );
        } catch {
            return `[Object that cannot be stringified: ${Object.prototype.toString.call(error)}]`;
        }
    }

    // Handle other primitives
    return String(error);
};
