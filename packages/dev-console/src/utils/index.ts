/**
 * Returns the server base URL derived from the current window location.
 * Works regardless of which port the Fastify server is running on.
 */
export const getBaseUrl = (): string => {
  return `${window.location.protocol}//${window.location.host}`
}
