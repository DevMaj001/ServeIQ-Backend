export const GATEWAY_SERVER = 'GATEWAY_SERVER';
export const PUBLIC_GATEWAY_SERVER = 'PUBLIC_GATEWAY_SERVER';

/** Returns the Socket.IO server for the public (customer) namespace, or undefined
 *  if it has not initialised yet. Used to push events (e.g. payment confirmed)
 *  to anonymous customers tracking their order without polling. */
export function getPublicServer(): any | undefined {
  return (globalThis as unknown as Record<string, any>)[PUBLIC_GATEWAY_SERVER];
}
