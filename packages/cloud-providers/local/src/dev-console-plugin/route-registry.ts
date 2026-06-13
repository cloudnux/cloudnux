export interface RouteInfo {
  method: string | string[]
  url: string
  handler: string
  registeredAt: Date,
  module?: string
}

class RouteRegistry {
  private routes: RouteInfo[] = []

  private static readonly IGNORED_METHODS = new Set(['OPTIONS', 'HEAD'])

  register(routeOptions: any): void {
    const methods: string[] = Array.isArray(routeOptions.method)
      ? routeOptions.method
      : [routeOptions.method]

    if (methods.every(m => RouteRegistry.IGNORED_METHODS.has(m.toUpperCase()))) {
      return
    }

    const routeInfo: RouteInfo = {
      method: routeOptions.method,
      url: routeOptions.url,
      handler: routeOptions.handler?.name || 'anonymous',
      registeredAt: new Date(),
      module: routeOptions.config?.module
    }

    this.routes.push(routeInfo)
  }

  getAll(): RouteInfo[] {
    return [...this.routes]
  }

  getByMethod(method: string): RouteInfo[] {
    return this.routes.filter(route => {
      if (Array.isArray(route.method)) {
        return route.method.includes(method.toUpperCase())
      }
      return route.method.toUpperCase() === method.toUpperCase()
    })
  }

  clear(): void {
    this.routes = []
  }

  count(): number {
    return this.routes.length
  }
}

export const routeRegistry = new RouteRegistry()