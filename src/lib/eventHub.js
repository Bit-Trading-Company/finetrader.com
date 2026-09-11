import { useMemo } from 'react';

/**
 * Minimal pub/sub used to pass wallet and selection events between sibling
 * components. It mirrors the Golden Layout event hub API (on/off/emit) so the
 * same components work on /home and on the regular pages.
 *
 * Events in use: wallets-generated, wallet-selected, request-wallet-state,
 * wallet-connection-changed, wallet-disconnected, collection-selected,
 * ordinal-selected, proxy-wallet-state-transfer.
 */
export const createEventHub = () => {
  const handlers = {};
  return {
    on: (event, handler) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    },
    off: (event, handler) => {
      if (handlers[event]) {
        handlers[event] = handlers[event].filter((h) => h !== handler);
      }
    },
    emit: (event, data) => {
      if (handlers[event]) {
        handlers[event].forEach((handler) => handler(data));
      }
    },
  };
};

/**
 * Event hub for a component tree: reuses `existingHub` when one is passed in
 * (a parent's hub or the Golden Layout hub), otherwise creates one.
 * @param {ReturnType<typeof createEventHub>} [existingHub]
 */
export const useEventHub = (existingHub) =>
  useMemo(() => existingHub || createEventHub(), [existingHub]);
