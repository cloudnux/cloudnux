export interface IService { };
export type ServiceKind = "storage" | "location" | "event-broker" | "functions" | "websocket" | "invoke" | "logger" | "email";


const _cloudContainer: Record<ServiceKind, (() => IService) | undefined> = {
    storage: undefined,
    location: undefined,
    "event-broker": undefined,
    functions: undefined,
    websocket: undefined,
    invoke: undefined,
    logger: undefined,
    email: undefined
};

export function registerService(kind: ServiceKind, factory: () => IService) {
    _cloudContainer[kind] = factory;
}

export function registerServices(services: Record<ServiceKind, () => IService>) {
    for (const kind in services) {
        if (services.hasOwnProperty(kind)) {
            _cloudContainer[kind as ServiceKind] = services[kind as ServiceKind];
        }
    }
}

export function getService<T extends IService>(kind: ServiceKind): T {
    const service = _cloudContainer[kind];
    if (!service) {
        throw new Error(`Service of kind ${kind} is not registered.`);
    }
    return service() as T;
}
