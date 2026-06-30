export type ServiceOverride = {
    kind: string;
    varName: string;
    path: string;
}

/**
 * Converts the `services` config map into entries ready to splice into a template:
 * a valid JS identifier per kind (e.g. "event-broker" -> "eventBrokerOverride")
 * and a forward-slash path safe to embed in a generated import statement on Windows.
 */
export function buildServiceOverrides(services: Record<string, string> = {}): ServiceOverride[] {
    return Object.entries(services).map(([kind, modulePath]) => ({
        kind,
        varName: kind.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()) + "Override",
        path: process.platform === "win32" ? modulePath.replace(/\\/g, "/") : modulePath,
    }));
}
