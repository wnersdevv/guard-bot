import { EventEmitter } from "node:events";

/**
 * Internal security event bus. Modules emit signals here instead of calling
 * each other directly, keeping the system decoupled.
 *
 * Events: security.threat | security.block | security.warning | security.raid |
 *         security.nuke | security.punishment
 */
class SecurityEventBus extends EventEmitter {}

export const securityBus = new SecurityEventBus();
securityBus.setMaxListeners(50);
